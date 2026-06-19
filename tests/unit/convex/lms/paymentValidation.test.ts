/**
 * Unit tests for convex/lms/payment/validation.ts — pure money-path math.
 *
 * Why these specific cases (SDD §7 / §3.3):
 *  - validateAmountAndCurrency (control #5, anti-tampering): currency mismatch
 *    and non-positive amounts must be rejected; the happy ARS path accepted.
 *  - computeRevenueSplitUsd (§3.3): the locked 80/20 split, rounded to cents.
 *  - sumMercadoPagoFees: fold MP fee_details into one number, null when absent.
 *  - currentPeriodYYYYMM: ledger period bucketing.
 */
import { describe, it, expect } from "vitest";
import {
  validateAmountAndCurrency,
  computeRevenueSplitUsd,
  sumMercadoPagoFees,
  currentPeriodYYYYMM,
} from "../../../../convex/lms/payment/validation";

describe("validateAmountAndCurrency — control #5 (anti-tampering)", () => {
  it("accepts a positive ARS charge against a positive USD order", () => {
    expect(
      validateAmountAndCurrency({
        orderPriceUsd: 90,
        fetchedAmount: 16200,
        fetchedCurrency: "ARS",
      })
    ).toEqual({ ok: true });
  });

  it("rejects a currency mismatch", () => {
    const r = validateAmountAndCurrency({
      orderPriceUsd: 90,
      fetchedAmount: 90,
      fetchedCurrency: "USD",
    });
    expect(r.ok).toBe(false);
    expect((r as { reason: string }).reason).toContain("currency_mismatch");
  });

  it("rejects a zero / negative charged amount", () => {
    expect(
      validateAmountAndCurrency({
        orderPriceUsd: 90,
        fetchedAmount: 0,
        fetchedCurrency: "ARS",
      }).ok
    ).toBe(false);
    expect(
      validateAmountAndCurrency({
        orderPriceUsd: 90,
        fetchedAmount: -100,
        fetchedCurrency: "ARS",
      }).ok
    ).toBe(false);
  });

  it("rejects a non-positive order price (corrupt order)", () => {
    expect(
      validateAmountAndCurrency({
        orderPriceUsd: 0,
        fetchedAmount: 16200,
        fetchedCurrency: "ARS",
      }).ok
    ).toBe(false);
  });

  it("honors a custom expected currency", () => {
    expect(
      validateAmountAndCurrency({
        orderPriceUsd: 90,
        fetchedAmount: 90,
        fetchedCurrency: "USD",
        expectedCurrency: "USD",
      })
    ).toEqual({ ok: true });
  });
});

describe("computeRevenueSplitUsd — §3.3 locked 80/20", () => {
  it("splits 90 USD into 18 / 72", () => {
    expect(computeRevenueSplitUsd(90)).toEqual({
      c14CutUsd: 18,
      zephyraCutUsd: 72,
    });
  });

  it("rounds to cents (no float dust)", () => {
    const { c14CutUsd, zephyraCutUsd } = computeRevenueSplitUsd(99.99);
    expect(c14CutUsd).toBe(20);
    expect(zephyraCutUsd).toBe(79.99);
    expect(Number((c14CutUsd + zephyraCutUsd).toFixed(2))).toBe(99.99);
  });
});

describe("sumMercadoPagoFees", () => {
  it("sums multiple fee entries", () => {
    expect(
      sumMercadoPagoFees([
        { type: "mercadopago_fee", amount: 100 },
        { type: "financing_fee", amount: 50 },
      ])
    ).toBe(150);
  });

  it("returns null for an empty / absent array", () => {
    expect(sumMercadoPagoFees([])).toBeNull();
    expect(sumMercadoPagoFees(undefined)).toBeNull();
  });

  it("returns null when the total is zero", () => {
    expect(sumMercadoPagoFees([{ type: "x", amount: 0 }])).toBeNull();
  });
});

describe("currentPeriodYYYYMM", () => {
  it("formats a fixed timestamp as YYYY-MM (UTC)", () => {
    // 2026-06-19T00:00:00Z
    expect(currentPeriodYYYYMM(Date.UTC(2026, 5, 19))).toBe("2026-06");
  });
});
