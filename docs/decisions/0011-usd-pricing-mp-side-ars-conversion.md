# ADR-0011 — USD pricing with MercadoPago-side ARS conversion

- **Status:** Accepted (2026-06-19)
- **Sprint:** SPRINT-ZEPHYRA-LMS-2
- **Spec:** `specs/008-zephyra-lms-foundation/` (Sprint 2 — Ventas)
- **Task:** P1.1 (pricing on catalog), P0.6 (ledger), P2.3 (this ADR)

## Context

Courses must carry a price (S2.1) and the revenue split (SDD §3.3 — 80% Zephyra
/ 20% Carbono14) must be tracked for the manual monthly payout. The Zephyra
MercadoPago account settles in ARS, but ARS is highly volatile against USD. If
prices were denominated in ARS, every FX move would require re-pricing the
catalog, and internal reporting (and the revenue split) would be in a currency
whose value drifts week to week. The business reasons about value in USD.

## Decision

1. **Store and display all prices in USD.** `lmsCourses.priceUsd` is the single
   source of truth for price; the catalog and course pages render USD.
2. **Create the MP preference in USD.** `createCheckoutSession` sends
   `currency_id: "USD"` with `unit_price = priceUsd`. MercadoPago performs the
   USD→ARS conversion at pay time using its own real-time rate and charges the
   buyer in ARS.
3. **Persist both figures.** On an approved payment we record the USD list price
   (`lmsPayments.usdAmount`, `lmsRevenueShares.grossUsd`) **and** the ARS amount
   MP actually charged (`grossArs`, fetched authoritatively). The 80/20 split is
   computed on the **USD** gross; the ARS figure is kept for MP reconciliation.

## Consequences

- Pricing is decoupled from ARS volatility: a course stays "USD 90" regardless
  of the daily rate; no catalog re-pricing churn.
- All business reporting and the revenue split are in USD — one stable unit.
- MercadoPago owns the FX rate, so we never carry a stale rate or need an FX
  oracle in V1. The amount the buyer pays always reflects MP's live rate.
- The anti-tamper check is currency-aware but cannot re-derive the exact ARS
  from USD without an FX feed; V1's guarantee is currency-match + amount > 0 +
  external_reference match, with the USD list price as the business anchor (see
  ADR-0010 and `validation.ts`). A V1.x can tighten to `ARS ≈ USD × rate ±
  tolerance` once an FX feed is wired.
- The ledger tracks two currencies per row by design — USD for business
  reporting, ARS for matching against MP's dashboard during the monthly payout.

## Alternatives considered

- **Store/price in ARS.** Rejected — ties the catalog to MP's local settlement
  currency, forces re-pricing on every FX move, and makes reporting and the
  revenue split drift with the rate. Breaks entirely on a future PSP swap or a
  non-AR region.
- **Store USD, convert with a self-maintained FX cache.** Rejected for V1 —
  adds a rate feed, a refresh job, and staleness handling for no benefit over
  letting MP convert at pay time. Reconsider only if a future PSP does not do
  the conversion for us.

## References

- SDD §3.3 (revenue model 80/20), §9.4 (USD pricing, MP-side FX)
- `convex/lms/payment/mercadopago.ts` (`createCheckoutSession` — `currency_id`)
- `convex/lms/payment/validation.ts` (`computeRevenueSplitUsd`,
  `validateAmountAndCurrency`), `ledger.ts`
- `convex/schema.ts` — `lmsCourses.priceUsd`, `lmsRevenueShares.{grossUsd,grossArs}`
