# ADR-0013 — Seat-pack data model: vitalicia licenses + single Owner Admin

- **Status:** Accepted (2026-06-23)
- **Sprint:** SPRINT-ZEPHYRA-LMS-3a (Sales Pack + Org Admin)
- **Spec:** `specs/008-zephyra-lms-foundation/data-model-sprint-3a-packs.md`
- **Branch:** `feature/010-zephyra-lms-packs`
- **Scope:** schema/data-model only (Phase A — the frozen contract).

## Context

Sprint 3a introduces the B2B revenue spine: an organization buys a pack of seats
for one course, and a single org admin claims those seats to learners. Designing
the data model surfaced three decisions worth recording, because each one closes
off an option that a naive reading of the SDD draft would have left open.

## Decision

1. **Single `ownerCustomerId`, not `adminCustomerIds: Id[]`.** The SDD draft
   suggested an array of org admins. Commercial §9.1 locks a **single Owner
   Admin** with no role matrix in V1. We model `lmsOrganizations.ownerCustomerId`
   as a single FK to `lmsCustomers`. It is cleaner, matches the commercial lock,
   and avoids materializing an N-N relationship that V1 does not need.
   Re-introducing multi-admin later is itself an additive change (a junction
   table or a nullable array column), so this decision is reversible without a
   destructive migration.

2. **Licenses are vitalicias (no expiration) in V1.** `lmsSeatPacks.expiresAt`
   exists but is **vestigial / nullable** — always `null` when a pack is minted
   today. It is kept in the schema (rather than omitted) so that a future
   expiring-license SKU is an additive change, not a migration. Correspondingly,
   `lmsSeats.status` has **no `"expired"` member** in V1 (`available` / `claimed`
   / `released` only). If expiring licenses ship later, adding `"expired"` to the
   union is additive.

3. **Seat release is a status change, not a soft-delete.** Every other LMS
   aggregate uses the repo's `deletedAt` / `deletedBy: Id<"adminUsers">`
   soft-delete. Seats deliberately do **not**: releasing a seat is a transition
   `claimed → released` that returns the seat to the `available` pool, and the
   actor is an `org_admin` (an `lmsCustomers` row), **not** an `adminUsers`. A
   `deletedBy: Id<"adminUsers">` field cannot represent that actor, and a release
   is a reversible pool operation, not a deletion. Release is gated on zero
   engagement: an enrollment with `progressPercent === 0 AND scoreRaw === null
   AND firstTouchedAt === null`.

4. **`lmsCustomers.organizationId` typed-narrow.** The Sprint-1 placeholder
   `v.optional(v.string())` is narrowed to `v.optional(v.id("lmsOrganizations"))`
   now that the org aggregate exists. Verified safe against the dev deployment:
   all current customers are `type: "individual"` with no `organizationId` set
   (zero non-null values), so no backfill is required and `convex dev` accepts
   the narrow.

## Consequences

- **Positive.** The model matches the commercial lock exactly; no premature N-N;
  the privacy gate (`lmsProgressConsents`) and idempotency keys
  (`lmsSeatPacks.by_order`, `lmsSeats.by_claim_request`,
  `lmsEnrollments.by_seat`) are explicit in the schema, so the backend
  invariants have index support and no full scans.
- **Negative / deferred.** Multi-admin orgs, expiring licenses, and a per-seat
  "expired" state are all out of V1; each is recoverable additively. The
  `expiresAt` / nullable column is dead weight until then (acceptable: a single
  nullable number).
- **For the backend.** The seat-mint branches in
  `convex/lms/payment/internal.ts` (APPROVED block) on `order.orderType`;
  `recordRevenueShare` and the buyer email stay common to b2c and pack. All
  balance / idempotency / privacy invariants are enforced in mutations (Convex
  indexes are not unique-constrained — the app enforces uniqueness on
  `lmsSeatPacks.orderId` and `lmsEnrollments.seatId`).
