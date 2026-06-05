# ADR-0008 — Password hashing: argon2id (via `hash-wasm`) + lazy re-hash + HMAC for opaque tokens

- **Status:** Accepted (2026-06-05)
- **Sprint:** SPRINT-ZEPHYRA-LMS-1
- **Spec:** `specs/008-zephyra-lms-foundation/`
- **Task:** T-ZL1-B01 (implementation), T-ZL1-F01 (this ADR)

## Context

Sprint 0 surfaced that the admin password column was stored as
`SHA-256(password + "zephyra-salt-2024")`. That construction has three
independent problems: SHA-256 is a general-purpose hash and not a
password-hashing function (no work factor, no memory cost), the salt is
static and shared across all rows (no per-user salting), and the parameters
are unconfigurable. A modest dictionary attack recovers the underlying
passwords in seconds. The same broken construction was reused for
`passwordResetTokens.tokenHash`. PDD §7.5 requires server-side enforced
authentication and OWASP-compliant password storage, so this could not
remain in the codebase past Sprint 1.

Convex 1.17 splits the function runtime: queries and mutations run in a V8
isolate exposing Web Crypto only; actions can opt into Node via `"use node";`
but a `"use node";` module cannot be imported from a non-`use node` module.
`convex/adminUsers.ts` exports mutations that perform hashing inline (login
verify, create, update, reset, seed), so the argon2 binding has to be
loadable from the V8 isolate. NAPI-native bindings like `@node-rs/argon2`
require `"use node";` and therefore cannot be reached from those mutations
without first promoting all of them to actions — a much wider diff that
trades raw CPU for additional Convex round-trips per call.

## Decision

1. **Password KDF.** argon2id via [`hash-wasm`](https://github.com/Daninet/hash-wasm),
   a pure-WebAssembly implementation that runs inside the Convex V8 isolate.
   OWASP 2024 parameters: `memorySize = 19456 KiB`, `iterations = 2`,
   `parallelism = 1`, `hashLength = 32`, `saltLength = 16`. The output is the
   `encoded` string (self-describing — algorithm, params, salt, and hash are
   all embedded), stored verbatim in `adminUsers.passwordHash`.
2. **Lazy re-hash for legacy rows.** Existing SHA-256 + static-salt hashes
   are NOT mass-rewritten. On the next successful login, the legacy verifier
   matches and `verifyPassword` returns `{ valid: true, needsRehash: true }`;
   the `login` mutation then patches the row to argon2id in the same
   transaction. No forced password reset, zero UX cost; eventual consistency
   as users log in over time.
3. **Opaque token hashing.** `passwordResetTokens.tokenHash` and
   `lmsMagicLinkTokens.tokenHash` use HMAC-SHA-256 via Web Crypto
   (`crypto.subtle.sign("HMAC", key, data)`) with a 32-byte key in
   `MAGIC_LINK_HMAC_KEY`. argon2id is the wrong primitive for opaque
   randomly-generated tokens: such tokens have full entropy already, and
   argon2's CPU + memory cost would burn resources for no security benefit.
   HMAC is deterministic, so the `by_token` lookup index stays O(1).
4. **Dev seed bootstrap.** `seedSuperAdmin` reads `DEV_ADMIN_DEFAULT_PASSWORD`
   from the environment and throws if it is absent. No password literal lives
   in the repo; the seed cannot silently fall back to a known value.
5. **Fail-fast on missing env.** `MAGIC_LINK_HMAC_KEY` is required at
   function-call time for any token mutation. A missing key throws clearly
   rather than emitting a hash that cannot be reproduced later.

## Consequences

- OWASP-compliant password storage on all new and migrated rows.
- Legacy users are migrated transparently on their next login; no forced
  reset, no support churn.
- Opaque tokens use the algorithm appropriate to opaque tokens, not the
  algorithm appropriate to user-chosen secrets. CPU and storage stay flat.
- The diff stayed inside `convex/`; no `src/` surface change, no
  mutation→action promotion of the auth path, and no client-side change to
  `convex.mutation(api.adminUsers.login, ...)`.
- argon2id via WASM is somewhat slower than NAPI on raw CPU, but the
  alternative ("promote auth mutations to actions calling a `"use node";`
  module") adds a Convex round-trip per call. End-to-end latency is
  comparable; the WASM path is the simpler one.
- `MAGIC_LINK_HMAC_KEY` must be set in every deploy environment.
- Two distinct hashing strategies coexist (passwords vs opaque tokens); the
  separation is documented in `convex/model/passwords.ts` and the legacy
  SHA-256 verify branch is marked read-only and not callable for new hashing.

## Migration record

B01 verified the lazy re-hash live on the dev deployment
(`dev:exuberant-corgi-88`). The row for `martinaafay@gmail.com` had its
`passwordHash` field upgraded from a SHA-256 hex string to a
`$argon2id$v=19$m=19456,t=2,p=1$...` encoded value on first login
post-merge, with no user-visible change.

## Alternatives considered

- **bcrypt.** Rejected — argon2id is the OWASP 2024 first choice; bcrypt is
  acceptable but not preferred, and choosing it would lock the platform into
  a weaker primitive on day one.
- **Native NAPI argon2 (`@node-rs/argon2`).** Rejected — incompatible with
  the Convex V8 isolate, would require promoting every auth mutation to an
  action.
- **Forced password reset for every legacy user.** Rejected — the legacy
  user set is small (~3 admin accounts) and the UX cost of mailing reset
  links and supporting confused users outweighs the (very short) period
  during which not-yet-logged-in legacy rows still carry the old hash.
- **argon2 for opaque tokens too.** Rejected — wrong primitive; high cost
  for zero gain, and would slow `by_token` lookups by forcing a recompute.

## References

- PDD v1.3 §7.5 (Sprint 1 security debt)
- SDD §12.4 (Q4 lock — argon2 binding picked at implementation time)
- OWASP Password Storage Cheat Sheet (2024 argon2id parameters)
- Convex docs — "Runtimes" (V8 isolate vs Node)
