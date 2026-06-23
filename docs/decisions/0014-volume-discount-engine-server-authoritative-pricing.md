# ADR-0014 — Volume-discount engine + server-authoritative pricing

- **Status:** Accepted (2026-06-23)
- **Sprint:** SPRINT-ZEPHYRA-LMS-3a (Sales Pack + Org Admin)
- **Spec:** `specs/008-zephyra-lms-foundation/` (Sprint 3 — B2B packs)
- **Branch:** `feature/010-zephyra-lms-packs`
- **Contracts:** `api-contract-sprint-3a-packs.md`, `data-model-sprint-3a-packs.md`

## Context

A B2B buyer purchases a *pack* of seats for one course; the more seats, the
lower the per-seat price. We had to decide (a) where the discount bands live,
(b) who computes the applied price, and (c) what the browser is allowed to send
at checkout. The money path is high-bar: a client that could name its own price
would be a direct revenue leak.

## Decision

1. **Discount bands are config, not code.** The volume tiers are seeded into
   `lmsVolumeDiscountTiers` (`seedVolumeDiscountTiers`, an idempotent
   internalMutation) — `1–9` (0%), `10–24` (10%), `25–49` (20%), `50+`
   (contact-only, `selfCheckoutAllowed: false`). Re-pricing is a config edit, not
   a deploy. The pure selection/quote helpers (`selectVolumeTier`,
   `computePackPriceQuote`) live in `convex/lms/packPricing.ts` and are unit-
   tested in isolation.

2. **The server is the sole pricing authority.** The browser sends ONLY
   `seatCount` — never a price, discount, or total. `computePackPrice` (a public
   query) returns the quote for display; `createPackCheckout` (the gated action)
   **recomputes** the total server-side before snapshotting the order, and the
   order carries the server total as the anti-tamper anchor. The frontend
   calculator (`PackCalculator`) renders the quote reactively but computes
   nothing — the bands table it shows is purely educational.

3. **The `50+` band is contact-only.** `selfCheckoutAllowed: false` ⇒ the
   calculator renders a "Contactanos" CTA, not a checkout button, and
   `createPackCheckout` independently rejects that band. A bespoke high-volume
   deal is a human-priced sale, not a self-serve checkout.

4. **The webhook validates the settled amount against the order total.** The MP
   webhook (`processVerifiedPayment`) re-validates the settled amount/currency
   against the server-computed order total; an underpaid or forged amount mints
   nothing (the `packMoneyPath` release gate pins this).

## Consequences

- **Positive.** The pricing authority is unambiguous and server-side; the
  client cannot influence the charge. Re-pricing is a config change. The display
  calculator and the authoritative price share one server source of truth.
- **Negative / deferred.** The `50+` path is a manual sale in V1 (no automated
  enterprise quoting). The bands table in the calculator is duplicated copy
  (display only) that must be kept in visual sync with the seeded tiers — a
  cheap, intentional duplication (the server quote is always authoritative).
- **For the frontend.** The pack calculator and the B2B catalog read the public
  quote; the org dashboard reads `getOrgSeatPacks` (a pure capacity read) which
  crosses no pricing or progress boundary. "Comprar más cupos" routes back to
  the same per-course pack page — the single priced surface.
