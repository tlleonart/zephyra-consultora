# Payout Runbook — Opción B (manual monthly settlement)

- **Status:** Active (V1)
- **Frequency:** Monthly (e.g. run on 2026-07-01 for June activity)
- **Owner:** Zephyra (with Carbono14 oversight)
- **Model:** Opción B — a single Zephyra MercadoPago account + a manual monthly
  payout of Carbono14's 20% cut. No automated payout in V1 (low volume, high
  trust).

## Where the data lives

Each **approved** payment writes exactly one `lmsRevenueShares` row (see
[ADR-0010](../docs/decisions/0010-webhook-idempotency-verify-before-trust.md)).
The relevant fields:

| Field | Meaning |
|-------|---------|
| `paymentId` | FK to the `lmsPayments` row |
| `grossUsd` | USD list price (the split is computed on this) |
| `grossArs` | ARS amount MercadoPago actually charged (for MP reconciliation) |
| `c14CutUsd` | Carbono14's 20% cut, USD |
| `zephyraCutUsd` | Zephyra's 80% cut, USD |
| `mpFees` | MercadoPago fee total, if MP returned it (optional) |
| `period` | accounting period, `YYYY-MM` (UTC) |
| `payoutId` | `null`/undefined until reconciled; stamped at settlement |

> Convex has no SQL. Query from the Convex dashboard (Data → `lmsRevenueShares`,
> filter by `period`) or with `npx convex run`. The table is indexed
> `by_period` and `by_payment_id`.

## Steps

1. **List the unsettled rows for the period.** In the Convex dashboard, open
   `lmsRevenueShares` and filter `period == "2026-06"` and `payoutId` empty.
   (Or script it: a small internal query over the `by_period` index returning
   rows whose `payoutId` is undefined.)

2. **Total Carbono14's cut.** Sum `c14CutUsd` over those rows.
   Worked example — 5 payments at USD 90 each = USD 450 gross:
   - Zephyra: USD 360 (80%, `zephyraCutUsd` summed)
   - Carbono14: USD 90 (20%, `c14CutUsd` summed) ← the amount to settle

3. **Settle in MercadoPago.**
   - Log into Zephyra's MercadoPago account.
   - Initiate a withdrawal of the Carbono14 total to Carbono14's bank account.
     (MP converts USD→ARS at its current rate and deposits to Zephyra's bank;
     Zephyra transfers to Carbono14 — or use MP's split/withdrawal UI if the
     account supports it.)
   - Record the MP settlement / withdrawal id.

4. **Reconcile in the platform.** Stamp `payoutId` with the settlement id on
   every row from step 1 (e.g. an internal mutation over the `by_period` index
   patching rows where `payoutId` is still empty). A stamped `payoutId` is what
   keeps the next month's run from re-counting these rows.

5. **Archive.** Export the period's rows (CSV/PDF), tag with the settlement date
   and amount, and store in the shared Zephyra + Carbono14 drive.

## Notes

- **No automated payout.** Opción B is manual by design at V1 volume.
- **`mpFees`.** Recorded when MP returns a fee breakdown. Deduct from gross only
  if the commercial agreement requires fee-sharing; otherwise Zephyra absorbs
  fees and the 80/20 split stands on `grossUsd`.
- **Currency.** The split is computed and reported in **USD** ([ADR-0011](../docs/decisions/0011-usd-pricing-mp-side-ars-conversion.md));
  `grossArs` is kept only to reconcile against MP's dashboard.
- **Disputes / refunds.** Refund *execution* is not in V1. If a payment is
  disputed or refunded in MP, mark the corresponding `lmsRevenueShares` row
  (and the linked order/payment) as disputed and reconcile manually; do not
  re-run an automated settlement against it.
- **Idempotency of the run.** Always filter on empty `payoutId` so a re-run of
  the same month never double-pays. Stamping `payoutId` (step 4) is the guard.
