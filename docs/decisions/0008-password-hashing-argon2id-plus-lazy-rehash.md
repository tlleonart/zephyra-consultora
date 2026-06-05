# ADR-0008 — Password hashing: argon2id (via `hash-wasm`) + lazy re-hash + HMAC for opaque tokens

**Status:** Draft (stub — full prose lands in Sprint 1 task F01)
**Date:** 2026-06-05
**Spec:** `specs/008-zephyra-lms-foundation/`
**Task:** T-ZL1-B01

## Context

Sprint 1 promotes the existing `adminUsers.passwordHash` from SHA-256 + a static
salt (`"zephyra-salt-2024"`) to a memory-hard KDF. The same task migrates the
hash on `passwordResetTokens.tokenHash` (and the upcoming
`lmsMagicLinkTokens.tokenHash`) — these are random opaque tokens, not user
secrets, so they need a different primitive than passwords.

Convex 1.17 splits queries/mutations (V8 isolate, Web Crypto only) from actions
(`"use node";`, full Node runtime). The chosen argon2 binding must run in the
V8 isolate because `convex/adminUsers.ts` exports mutations that perform the
hashing inline (login verify, create, update, reset, seed). A `"use node";`
module cannot be imported from a non-`use node` file, which rules out native
NAPI bindings like `@node-rs/argon2`.

## Decision

1. **Password KDF:** argon2id via [`hash-wasm`](https://github.com/Daninet/hash-wasm)
   (pure WebAssembly, runs in the V8 isolate). OWASP 2024 parameters:
   `memorySize=19456 KiB`, `iterations=2`, `parallelism=1`, `hashLength=32`,
   `saltLength=16`. Output is the `encoded` string (self-describing — contains
   algorithm, params, salt, hash).
2. **Lazy migration:** legacy SHA-256 rows are NOT mass-rewritten. On the next
   successful login, `verifyPassword` returns `{ valid: true, needsRehash: true }`
   and the `login` mutation patches the row to argon2id in the same transaction.
   Zero UX impact; eventual consistency.
3. **Opaque token hashing:** HMAC-SHA-256 via Web Crypto
   (`crypto.subtle.sign("HMAC", key, data)`) with a 32-byte key in
   `MAGIC_LINK_HMAC_KEY`. Random tokens have full entropy; argon2 would burn
   CPU for no security benefit and is the wrong primitive.
4. **Dev seed bootstrap:** `seedSuperAdmin` reads `DEV_ADMIN_DEFAULT_PASSWORD`
   from env and throws if absent. No password literal lives in the repo.

## Consequences

- Diff stays inside `convex/`. No `src/` surface change. No mutation→action
  promotion. Existing client code (`convex.mutation(api.adminUsers.login, ...)`)
  is untouched.
- Argon2 via WASM is slightly slower than native NAPI on Node, but the
  alternative (Option A — promote auth mutations to actions calling a
  `"use node";` module) widens the diff to `src/` and trades raw CPU for an
  extra Convex round-trip per call. Net latency is comparable.
- `passwordResetTokens.tokenHash` shape becomes HMAC-hex. Lookup by
  `by_token` index remains O(1) since HMAC is deterministic. Legacy reset
  rows (if any remain in flight) drain via a fallback scan in `resetPassword`
  — tokens are single-use and short-lived (1h) so the scan path empties fast.
- The legacy SHA-256 + static salt verify code lives in
  `convex/model/passwords.ts` as a read-only branch. It MUST NOT be called for
  new hashing; a comment in the file makes that explicit.

## References

- PDD v1.3 §7.5 (Sprint 1 security debt)
- SDD §12.4 (Q4 lock — argon2 binding picked at implementation time)
- OWASP Password Storage Cheat Sheet (2024 argon2id params)
- Convex docs — "Runtimes" (V8 isolate vs Node)
