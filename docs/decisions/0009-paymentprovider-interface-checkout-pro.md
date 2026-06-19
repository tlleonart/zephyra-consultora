# ADR-0009 — PaymentProvider interface + MercadoPago Checkout Pro

- **Status:** Accepted (2026-06-19)
- **Sprint:** SPRINT-ZEPHYRA-LMS-2
- **Spec:** `specs/008-zephyra-lms-foundation/` (Sprint 2 — Ventas)
- **Task:** P0.1 (sales-domain contract), P1.2 (checkout flow), P2.3 (this ADR)

## Context

Sprint 2 introduces B2C checkout: a learner buys a single course and is
enrolled on payment. The payment service provider (PSP) for V1 is MercadoPago
(the Zephyra account is Argentine, MercadoPago is the dominant local rail). The
business roadmap, however, anticipates additional PSPs (Stripe, dLocal) for
non-AR regions in V1.x. We had to decide (a) whether to write code directly
against the MercadoPago API or behind an abstraction, and (b) which MercadoPago
integration surface to use — Checkout Pro (MP-hosted redirect) or Bricks
(browser-side card tokenization embedded in our page).

## Decision

1. **PaymentProvider interface from day one.** A `PaymentProvider` contract
   (`convex/lms/payment/types.ts`) declares the four operations the money path
   needs — `createCheckoutSession`, `verifyWebhook`, `fetchPaymentState`,
   `refund`. `MercadoPagoAdapter` (`convex/lms/payment/mercadopago.ts`) is the
   sole V1 implementation. All money-path code (checkout action, webhook
   handler) depends on the interface shape, never on MercadoPago specifics
   beyond the adapter boundary.
2. **MercadoPago Checkout Pro (hosted redirect), not Bricks.** `createCheckout`
   opens a Checkout Pro `preference` (POST `/checkout/preferences`) and returns
   the `init_point`; the buyer is redirected to MP's hosted payment page and
   returns via `back_urls`. We do not embed card fields in our own UI.

## Consequences

- A second PSP can be activated by writing a new adapter against the same
  interface — no refactor of the checkout action, webhook handler, ledger, or
  enrollment path. The adapter is the single seam.
- Checkout Pro keeps **all** PCI scope on MercadoPago: no card data ever touches
  the Zephyra origin, so there is no PCI-DSS SAQ-A-EP burden, no tokenization
  code, and no card-field UI to build or secure.
- Cost: roughly +2 EU of contract/abstraction work in P0 versus calling MP
  directly. Paid back the first time a second PSP is needed; a defensible bet
  given the documented V1.x roadmap.
- `refund` is declared on the interface but throws "deferred to V1.x" in the
  adapter — the contract is complete, the implementation is scoped out of V1.

## Alternatives considered

- **MercadoPago Bricks (browser-side tokenization).** Rejected — Bricks puts a
  card-entry surface on our origin (more UI to build, more attack surface, more
  PCI consideration) for a single-item B2C purchase where a hosted redirect is
  entirely sufficient. The UX difference (staying on-domain vs a redirect) does
  not justify the added surface for two courses at low volume.
- **Hard-coded MercadoPago, no PSP abstraction.** Rejected — fastest to write,
  but locks the platform to one vendor and makes the documented multi-PSP V1.x
  roadmap a rewrite rather than an addition. The abstraction cost is small and
  the boundary is natural (one adapter class).

## References

- SDD §3.3 (revenue model), §7 (money-path security controls), §9.4 (USD
  pricing with MP-side FX)
- MercadoPago docs — Checkout Pro (preferences) vs Checkout Bricks
- `convex/lms/payment/types.ts` (the interface), `mercadopago.ts` (the adapter)
