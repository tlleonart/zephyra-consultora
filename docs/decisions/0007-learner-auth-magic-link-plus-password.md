# ADR-0007 — Learner auth: magic-link primary + optional password + distinct cookie / signing key

- **Status:** Accepted (2026-06-05)
- **Sprint:** SPRINT-ZEPHYRA-LMS-1
- **Spec:** `specs/008-zephyra-lms-foundation/`
- **Relates to:** [ADR-0001](./0001-extend-zephyra-consultora-with-lms.md)
  (which kept `jose`-based JWT auth and noted the learner audience would reuse
  the pattern with a separate cookie and key), [ADR-0008](./0008-password-hashing-argon2id-plus-lazy-rehash.md)
  (hashing primitives for passwords and opaque tokens).

## Context

Sprint 1 introduces the learner audience to the platform (admin auth already
exists from Sprint 0). PDD §7.5 and the G1 product lock (2026-06-05) require:

- Magic-link as the primary entry path (lowest friction for both B2C and B2B
  onboarding).
- Optional password set after first activation (for learners who prefer it).
- Both flows shipped together in this sprint (Tomás: "no quiero que quede colgado").
- Strict separation between the learner audience and the admin audience —
  compromising one cookie must not grant access to the other.

The institutional admin surface uses a `session` cookie signed with
`SESSION_SECRET` and is protected by `src/middleware.ts`. Reusing the same
cookie and key for learners would unify the two audiences into a single
authentication boundary, which is the failure mode we need to prevent.

## Decision

1. **Separate table for learners.** `lmsCustomers` stores learner identity,
   distinct from `adminUsers`. The two tables never share rows; references
   between them (when needed for audit fields like `deletedBy`) are explicit
   and typed (see [ADR-0004](./0004-lms-as-feature-track-not-separate-repo.md)
   §2).
2. **Magic-link tokens.** `lmsMagicLinkTokens` stores the per-link token
   record. The `tokenHash` field is computed via HMAC-SHA-256 with the env key
   `MAGIC_LINK_HMAC_KEY` (not argon2id — see ADR-0008 §3). Single-use is
   enforced by setting `usedAt` on first consume; subsequent uses of the same
   token are rejected. TTLs: 30 min for `learner_activation`, 15 min for
   `learner_signin` and `learner_recovery`.
3. **Distinct JWT signing key.** Learner sessions are minted by
   `src/features/auth-learner/lib/session.ts` using the env key
   **`LEARNER_JWT_SECRET`**, which is required to be distinct from
   `SESSION_SECRET`. Even a stolen admin token cannot be replayed as a
   learner session, and vice versa — the signatures will not validate against
   the wrong key.
4. **Distinct cookie name.** Learner sessions live in the **`session-learner`**
   cookie. The admin middleware reads only `session`; the learner middleware
   branch reads only `session-learner`. Audience confusion is prevented at the
   name layer, not just at the signature layer.
5. **Session TTL.** Learner sessions get a 7-day TTL (lower friction for
   course consumption); admin sessions remain at the existing 30-minute TTL
   (higher security for CMS access).
6. **Cross-surface escalation is structurally impossible.** Distinct table,
   distinct cookie name, distinct signing key, distinct middleware branch.
   This was verified by unit tests in B04 (session helpers reject wrong-key
   tokens) and by the C03/C04 manual smoke (admin cookie does not unlock
   `/cursos`-gated routes; learner cookie does not unlock `/admin`).

## Consequences

- A compromise of the learner cookie cannot forge admin auth. A compromise of
  the admin cookie cannot forge a learner session for an arbitrary learner.
- Two parallel cookie systems must be operated — but they share the same
  primitives (`jose` 5.9, HS256), so the operational cost is documentation
  rather than new infrastructure.
- `src/middleware.ts` carries two parallel branches (one per audience). They
  are independent: changing one cannot affect the other.
- A migration was needed for the Sprint-0 placeholder identity. The Sprint-0
  `convex/lms/auth.ts` carried a placeholder `learnerId: v.string()` for the
  spike. D01 wiped the placeholder rows and migrated `learnerId` on
  `lmsEnrollments` and `lmsScormEvents` to `Id<"lmsCustomers">`.

## Alternatives considered

- **Shared `session` cookie with a `role` flag** distinguishing admin from
  learner. Rejected — a single cookie compromise then compromises BOTH
  audiences. Distinct cookies + distinct keys is the conservative default.
- **Convex-native `ctx.auth.getUserIdentity()`** (e.g. Clerk-style
  integration). Rejected — would require migrating all existing admin code
  off `jose`/`session`, which is out of sprint scope and orthogonal to the
  learner-auth question. ADR-0001 already ratified the existing pattern.
- **Password-first with magic-link as fallback** (the inverse of the chosen
  ordering). Rejected at the PDD stage — onboarding friction is the dominant
  cost in B2C/B2B course sales, and a magic-link-first flow removes the
  "create a password to view your course" wall on first contact.
