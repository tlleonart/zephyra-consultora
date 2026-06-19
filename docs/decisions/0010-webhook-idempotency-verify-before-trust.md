# ADR-0010 — Webhook idempotency + verify-before-trust

- **Status:** Accepted (2026-06-19)
- **Sprint:** SPRINT-ZEPHYRA-LMS-2
- **Spec:** `specs/008-zephyra-lms-foundation/` (Sprint 2 — Ventas)
- **Task:** P0.4 (webhook handler), P0.5 (entitlement), P0.6 (ledger), P2.3 (this ADR)

## Context

The MercadoPago webhook is the load-bearing edge of the money path: it is the
event that mints an enrollment and writes a revenue-share ledger row. Webhooks
are an inherently hostile input — MercadoPago may deliver the same notification
more than once, may deliver out of order (the webhook can arrive before the
buyer's browser returns via `back_url`), and the raw HTTP body is forgeable by
anyone who learns the endpoint URL. SDD §7 (Tomás-signed) requires that a
duplicate webhook yields exactly one payment and one enrollment, that no client
path can mint an entitlement, and that webhook state is never trusted from the
payload.

Convex's runtime split shapes the solution: an `httpAction` (where the webhook
lands) can do outbound HTTP and read env but is **not** transactional and has no
`ctx.db`; only a `mutation` is transactional. So idempotency cannot be
guaranteed in the action — a read-then-write there races against a concurrent
duplicate delivery.

## Decision

1. **Verify-before-trust.** The httpAction (`convex/lms/payment/webhook.ts`)
   first verifies the `x-signature` HMAC against `MP_WEBHOOK_SECRET` (constant-
   time compare). A signature mismatch returns 401 and never proceeds. Only the
   resource `id` is taken from the (untrusted) body; the authoritative state —
   status, amount, currency, `external_reference` — is fetched directly from MP
   (`GET /v1/payments/{id}`). The webhook payload's own state/amount fields are
   never used for any decision.
2. **Triple idempotency.** (a) The checkout reuses an in-flight
   `pending_payment` order for the same (learner, course) — double-click
   collapse. (b) A **unique-by-application index** on `lmsPayments.mpPaymentId`
   (`by_mp_payment_id`) is the hard backstop: the transactional
   `processVerifiedPayment` mutation looks it up first and short-circuits to an
   idempotent no-op if the payment was already recorded. (c) Enrollment uses
   lookup-before-insert on the active (learner, course) row, and the ledger
   short-circuits on an existing row for the payment.
3. **One transaction owns the writes.** The dedupe check, payment insert,
   order-status patch, enrollment grant, and ledger write all run inside the
   single `processVerifiedPayment` mutation. Convex's per-transaction
   serializability is therefore the *structural* idempotency guarantee, not a
   hopeful read-then-write in the non-transactional action.
4. **Response policy.** 401 only on signature mismatch (the endpoint is
   authenticated; the attacker/MP learns the delivery was rejected). Every other
   outcome — order-not-found, amount-mismatch, transient MP fetch failure,
   already-processed — returns 200 so MercadoPago does not enter a retry storm
   on a condition a retry cannot fix. Forensic detail lives in
   `lmsPayments.webhookEventLog` and the structured logs.

## Consequences

- A duplicate delivery is provably a no-op: the unique mpPaymentId index plus
  single-transaction check make a second enrollment or a second ledger row
  structurally impossible, not merely unlikely.
- A forged webhook cannot mint an enrollment: it fails the HMAC check (401), and
  even a replayed-but-valid signature resolves to authoritative MP state, so a
  tampered amount is caught by the anti-tamper check.
- Out-of-order delivery is handled: enrollment is driven by the fetched state,
  not the `back_url` the browser happened to hit. The return page reads the real
  order status from the DB (`getOrderById`), not the redirect query string.
- Cost: roughly +3 EU on the webhook + its tests. Three integration tests are
  **release gates** (T1 duplicate webhook, T2 webhook-before-return, T3 rejected
  payment) and must stay green for any money-path change.
- The `pending` MP status writes no durable row (so the later resolving webhook
  is the first to insert and the dedupe stays clean).

## Alternatives considered

- **Single-point idempotency (mpPaymentId only).** Rejected — leaves the
  order-reuse race open (double-click spawns two pending orders) and the
  re-grant race on enrollment. Defense-in-depth at each layer is cheap and
  removes whole classes of edge case.
- **Trust the webhook payload (skip the MP fetch).** Rejected — faster by one
  round-trip, but a forged or tampered body could mint an enrollment or
  understate the charge. Directly violates the SDD §7 verify-before-trust
  requirement.
- **Idempotency in the httpAction (read-then-write before delegating).**
  Rejected — the action is not transactional; two concurrent deliveries can both
  pass the "not seen yet" read and both insert. The guarantee has to live in a
  mutation.

## References

- SDD §7 (money-path security controls — signed controls #1–#6)
- `convex/lms/payment/webhook.ts`, `internal.ts`, `ledger.ts`,
  `convex/lms/enrollments.ts` (grantEnrollmentForOrder)
- `convex/schema.ts` — `lmsPayments.by_mp_payment_id` unique-by-application index
- Tests: `tests/unit/convex/lms/paymentProcessing.test.ts` (T1/T2/T3)
