/**
 * LMS — Money-path validation helpers (Sprint 2 Phase P0).
 *
 * Pure, dependency-free functions for the anti-tampering controls in the
 * webhook path (SDD §7 — Tomás-signed). Kept separate from the Convex runtime
 * so they unit-test without a ctx / env / network.
 *
 * Currency policy (SDD §9.4): orders are priced in USD; MercadoPago converts to
 * ARS on its side and charges the buyer in ARS. We therefore cannot
 * independently re-derive the exact ARS figure without an FX oracle (out of
 * scope for V1). The V1 anti-tampering guarantee is:
 *   - the fetched payment currency matches the expected settlement currency, and
 *   - the fetched amount is strictly positive, and
 *   - the fetched payment's external_reference matches the order we resolved.
 * The external_reference + verified-state checks are the load-bearing controls;
 * the amount/currency check is the backstop. A future V1.x can tighten this to
 * `ARS ≈ USD × rate ± tolerance` once an FX feed is wired.
 */

/** Default settlement currency for the MercadoPago AR account. */
export const DEFAULT_SETTLEMENT_CURRENCY = "ARS";

/**
 * Validate the fetched payment's amount + currency against the order.
 *
 * @param orderPriceUsd  the USD list price recorded on the Order (must be > 0)
 * @param fetchedAmount  the amount MP actually charged (native currency)
 * @param fetchedCurrency the ISO currency of `fetchedAmount` (e.g. "ARS")
 * @param expectedCurrency the settlement currency we expect (default "ARS")
 */
export function validateAmountAndCurrency(args: {
  orderPriceUsd: number;
  fetchedAmount: number;
  fetchedCurrency: string;
  expectedCurrency?: string;
}): { ok: true } | { ok: false; reason: string } {
  const {
    orderPriceUsd,
    fetchedAmount,
    fetchedCurrency,
    expectedCurrency = DEFAULT_SETTLEMENT_CURRENCY,
  } = args;

  if (!(orderPriceUsd > 0)) {
    return { ok: false, reason: "order_price_not_positive" };
  }
  if (fetchedCurrency !== expectedCurrency) {
    return {
      ok: false,
      reason: `currency_mismatch:expected=${expectedCurrency},got=${fetchedCurrency}`,
    };
  }
  if (!(fetchedAmount > 0)) {
    return { ok: false, reason: "amount_not_positive" };
  }
  return { ok: true };
}

/**
 * Compute the 80/20 revenue split on the USD gross.
 * Locked at decomposition (SDD §3.3): Carbono14 takes 20%, Zephyra 80%.
 * Rounded to 2 decimals to avoid float dust in the ledger.
 */
export function computeRevenueSplitUsd(grossUsd: number): {
  c14CutUsd: number;
  zephyraCutUsd: number;
} {
  const round2 = (n: number): number => Math.round(n * 100) / 100;
  return {
    c14CutUsd: round2(grossUsd * 0.2),
    zephyraCutUsd: round2(grossUsd * 0.8),
  };
}

/**
 * Sum the MercadoPago fee_details into a single number (or null when absent).
 * MP returns an array of `{ type, amount }`; we sum the amounts.
 */
export function sumMercadoPagoFees(
  feeDetails: Array<{ type: string; amount: number }> | undefined
): number | null {
  if (!feeDetails || feeDetails.length === 0) return null;
  const total = feeDetails.reduce(
    (sum, f) => sum + (typeof f.amount === "number" ? f.amount : 0),
    0
  );
  return total > 0 ? total : null;
}

/** Current accounting period as YYYY-MM (UTC). */
export function currentPeriodYYYYMM(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 7);
}
