# ADR-0012 — Order/payment state machine (no intermediate states)

- **Status:** Accepted (2026-06-19)
- **Sprint:** SPRINT-ZEPHYRA-LMS-2
- **Spec:** `specs/008-zephyra-lms-foundation/` (Sprint 2 — Ventas)
- **Task:** P0.3 (orders), P1.3 (return pages), P2.3 (this ADR)

## Context

An order moves from creation to a terminal outcome driven by the authoritative
MercadoPago webhook. The webhook can be slow relative to the buyer's browser
return, so we had to choose how rich the order state machine should be — a
minimal create→terminal model, or an event-sourced chain that records every
intermediate transition (e.g. `payment_received` → `payment_confirmed`). The
V1 volume is small (two courses, an estimated ~50 enrollments/month).

## Decision

1. **Four order states, no intermediate.** `lmsOrders.status` is
   `pending_payment` → (`paid` | `failed` | `cancelled`). There is no state
   between order creation and the webhook-driven terminal outcome.
2. **The webhook is the only writer of terminal status.** Order creation sets
   `pending_payment`; only `processVerifiedPayment` (on authoritative MP state)
   advances it to `paid` / `failed` / `cancelled`. Stamping the MP preference id
   does **not** change status.
3. **The return page polls a live query.** When the webhook is slower than the
   redirect, the buyer lands on the return page and a Convex live query
   (`getOrderById`) shows `pending` until the webhook flips it to `paid`, then
   the UI updates reactively. The DB is the source of truth, never the
   `back_url` the browser happened to hit.

## Consequences

- The model is trivial to reason about and to test: a row is in exactly one of
  four states, transitions are few, and the only transition writer is one
  mutation. No state-diagram maintenance.
- A slow webhook is a UX detail (a brief "pending" view that updates live), not
  a correctness problem — entitlement is still driven by authoritative state.
- The state machine carries no audit history of intermediate transitions; the
  forensic trail instead lives in `lmsPayments.webhookEventLog` (the appended
  event log) plus the structured money-path logs. That is sufficient for V1
  reconciliation and debugging.
- If volume or product needs grow (refunds, partial captures, multi-item carts),
  a richer state model can be introduced later — but it is explicitly **not**
  warranted at V1 scale.

## Alternatives considered

- **Event-sourced order lifecycle** (`pending` → `payment_received` →
  `payment_confirmed`, persisting each transition). Rejected — roughly +2 EU of
  complexity (more states, more transitions, more tests) for zero V1 benefit at
  ~50 enrollments/month. The `webhookEventLog` already captures the forensic
  trail without a formal event-sourcing model.
- **Optimistic enroll on `back_url` success, reconcile later.** Rejected — the
  `back_url` is a browser-controlled UX hint and can be forged or skipped;
  enrolling on it would violate verify-before-trust (ADR-0010).

## References

- SDD §7 (verify-before-trust), §4 (S2 success criteria)
- `convex/lms/payment/orders.ts` (`createOrder`, `getOrderById`),
  `internal.ts` (`processVerifiedPayment` — the only status writer)
- `convex/schema.ts` — `lmsOrders.status` union
