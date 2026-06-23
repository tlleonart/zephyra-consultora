# ADR-0015 — Seat state machine + minting/claim idempotency (vitalicias)

- **Status:** Accepted (2026-06-23)
- **Sprint:** SPRINT-ZEPHYRA-LMS-3a/3b (Sales Pack + seat lifecycle)
- **Spec:** `specs/008-zephyra-lms-foundation/`
- **Branch:** `feature/010-zephyra-lms-packs`
- **Contracts:** `api-contract-sprint-3a-packs.md`, `api-contract-sprint-3b.md`,
  `data-model-sprint-3a-packs.md`

## Context

A paid pack mints seats; an org admin invites employees who claim those seats;
an admin can release an unstarted seat. Across a flaky network and a
retry-happy MP webhook, every one of those transitions must be exactly-once.
We also had to reconcile the seat lifecycle with PDD §10, which contemplated
**expiring** licenses.

## Decision

1. **Seat states: `available` → `claimed` → `released` (no `expired`).** A seat
   is minted `available`, becomes `claimed` on a successful claim, and returns to
   `released` (re-claimable) on an admin release. There is deliberately **no
   `expired` seat state** — which is the load-bearing half of the next point.

2. **Licenses are vitalicias — this SUPERSEDES PDD §10.** PDD §10 contemplated
   expiring licenses. V1 ships **lifetime** licenses: `lmsSeatPacks.expiresAt` is
   minted `null` (vestigial, kept for an additive future SKU) and the seat union
   has no `expired` member. This ADR records that the no-expiration model
   **supersedes PDD §10** for V1; re-introducing expiry later is additive
   (add `expiresAt` population + an `expired` seat-state member), not a migration.

3. **Mint idempotency is keyed on `orderId`.** `mintSeatPackForOrder`
   (internalMutation, reached only from the approved-webhook
   `processVerifiedPayment`) does lookup-before-insert on `lmsSeatPacks.by_order`.
   A replayed approved webhook for the same order finds the existing pack and
   mints NOTHING — exactly one `lmsSeatPacks` row + exactly N `lmsSeats` per paid
   order, forever. (The webhook's `by_mp_payment_id` dedupe is the first guard;
   this is the second, structural one.)

4. **Claim idempotency is keyed on `claimRequestId`.** `claimSeat` does
   lookup-before-insert on `lmsSeats.by_claim_request`; a replay with the SAME
   `claimRequestId` returns the existing seat + enrollment (`alreadyClaimed:
   true`) — no second seat, no second enrollment. The enrollment is additionally
   unique per seat via the app-enforced `lmsEnrollments.by_seat` index. The seat
   balance invariant (`availableSeats + claimedSeats ≤ totalSeats`) is held
   transactionally on every claim/release.

5. **Release is a status change gated on zero engagement.** `releaseSeat`
   transitions `claimed → released` (`availableSeats++ / claimedSeats--`) and ends
   the enrollment via a status change to `expired` (the *enrollment* status, not a
   seat status — note the asymmetry with point 1) with `seatId` detached. It is
   NOT a soft-delete (the actor is an `org_admin` / `lmsCustomers`, not an
   `adminUsers`). Release is permitted ONLY at zero engagement on all three
   signals (`progressPercent === 0 && scoreRaw === undefined && firstTouchedAt ===
   undefined`); a started learner cannot be released.

## Consequences

- **Positive.** Both money-path mints (pack) and the claim are exactly-once with
  explicit index support — no full scans, no double-charge / double-grant. The
  vitalicia model removes an entire expiry-billing surface from V1.
- **Negative / deferred.** No expiring SKU, no per-seat `expired` state in V1;
  each is additive later. The enrollment-`expired` vs seat-no-`expired`
  asymmetry is a deliberate, documented subtlety (the enrollment ends; the seat
  returns to the pool).
- **For the frontend.** The claim landing routes the new `org_learner` into the
  SAME player UX as B2C (gated on `getMyEnrollment`). The dashboard's "Marcar
  baja" attempts `releaseSeat` and surfaces the zero-engagement rejection clearly
  rather than reconstructing per-learner engagement (which the roster
  intentionally omits for privacy — see ADR-0016).
