/**
 * Unit tests for convex/lms/packPricing.ts — server-authoritative pack pricing.
 *
 * Why these cases (SDD commercial §9.x, anti-tamper #5):
 *  - computePackPriceQuote across ALL bands + the boundaries 9/10, 24/25, 49/50,
 *    and the 50+ self-checkout reject (the "Contactanos" cut).
 *  - selectVolumeTier picks the most specific band; the open-ended top band
 *    catches everything at/above its floor.
 *  - invalid seatCount (0, negative, non-integer) and an unpriced course reject.
 *
 * The math is the ONLY pricing authority — the client never supplies a price, so
 * these tests pin the exact totals the checkout path will snapshot onto an order
 * and the webhook will anti-tamper against.
 */
import { describe, it, expect } from "vitest";
import {
  computePackPriceQuote,
  selectVolumeTier,
  SEED_VOLUME_TIERS,
  type VolumeTier,
} from "../../../../convex/lms/packPricing";

// The canonical seed bands, normalized to VolumeTier (maxSeats null = open).
const TIERS: VolumeTier[] = SEED_VOLUME_TIERS.map((t) => ({
  minSeats: t.minSeats,
  maxSeats: t.maxSeats,
  discountPct: t.discountPct,
  selfCheckout: t.selfCheckout,
}));

const UNIT = 100; // $100/seat list price — round numbers make the math obvious.

function quote(seatCount: number, unitPriceUsd = UNIT) {
  return computePackPriceQuote({ unitPriceUsd, seatCount, tiers: TIERS });
}

describe("selectVolumeTier — band selection", () => {
  it("picks the 1–9 band for small counts", () => {
    expect(selectVolumeTier(TIERS, 1)?.minSeats).toBe(1);
    expect(selectVolumeTier(TIERS, 9)?.minSeats).toBe(1);
  });
  it("picks the 10–24 band", () => {
    expect(selectVolumeTier(TIERS, 10)?.minSeats).toBe(10);
    expect(selectVolumeTier(TIERS, 24)?.minSeats).toBe(10);
  });
  it("picks the 25–49 band", () => {
    expect(selectVolumeTier(TIERS, 25)?.minSeats).toBe(25);
    expect(selectVolumeTier(TIERS, 49)?.minSeats).toBe(25);
  });
  it("picks the open-ended 50+ band for anything ≥ 50", () => {
    expect(selectVolumeTier(TIERS, 50)?.minSeats).toBe(50);
    expect(selectVolumeTier(TIERS, 10000)?.minSeats).toBe(50);
  });
  it("returns null below the lowest floor (seatCount 0)", () => {
    expect(selectVolumeTier(TIERS, 0)).toBeNull();
  });
});

describe("computePackPriceQuote — bands + discounts", () => {
  it("band 1–9: 0% discount", () => {
    const r = quote(5);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.quote.appliedDiscountPct).toBe(0);
    expect(r.quote.unitPriceUsd).toBe(100);
    expect(r.quote.totalPriceUsd).toBe(500); // 5 × 100 × 1.00
    expect(r.quote.selfCheckoutAllowed).toBe(true);
  });

  it("band 10–24: 10% discount", () => {
    const r = quote(10);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.quote.appliedDiscountPct).toBe(10);
    expect(r.quote.totalPriceUsd).toBe(900); // 10 × 100 × 0.90
    expect(r.quote.selfCheckoutAllowed).toBe(true);
  });

  it("band 25–49: 20% discount", () => {
    const r = quote(25);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.quote.appliedDiscountPct).toBe(20);
    expect(r.quote.totalPriceUsd).toBe(2000); // 25 × 100 × 0.80
    expect(r.quote.selfCheckoutAllowed).toBe(true);
  });
});

describe("computePackPriceQuote — band boundaries", () => {
  it("9 vs 10 — last 0% seat vs first 10% seat", () => {
    const nine = quote(9);
    const ten = quote(10);
    expect(nine.ok && nine.quote.appliedDiscountPct).toBe(0);
    expect(nine.ok && nine.quote.totalPriceUsd).toBe(900); // 9 × 100 × 1.00
    expect(ten.ok && ten.quote.appliedDiscountPct).toBe(10);
    expect(ten.ok && ten.quote.totalPriceUsd).toBe(900); // 10 × 100 × 0.90
  });

  it("24 vs 25 — last 10% seat vs first 20% seat", () => {
    const a = quote(24);
    const b = quote(25);
    expect(a.ok && a.quote.appliedDiscountPct).toBe(10);
    expect(b.ok && b.quote.appliedDiscountPct).toBe(20);
  });

  it("49 vs 50 — last self-serve seat vs first Contactanos seat", () => {
    const a = quote(49);
    const b = quote(50);
    expect(a.ok && a.quote.appliedDiscountPct).toBe(20);
    expect(a.ok && a.quote.selfCheckoutAllowed).toBe(true);
    // 50+ remains a valid quote (so the UI can show a per-seat estimate) but
    // self-checkout is cut — the checkout path rejects on this flag.
    expect(b.ok && b.quote.selfCheckoutAllowed).toBe(false);
  });
});

describe("computePackPriceQuote — 50+ reject + invalid inputs", () => {
  it("50+ band returns selfCheckoutAllowed:false ('Contactanos')", () => {
    const r = quote(75);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.quote.selfCheckoutAllowed).toBe(false);
  });

  it("rejects seatCount 0", () => {
    const r = quote(0);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("seat_count_invalid");
  });

  it("rejects a negative seatCount", () => {
    const r = quote(-5);
    expect(r.ok).toBe(false);
  });

  it("rejects a non-integer seatCount", () => {
    const r = quote(3.5);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("seat_count_invalid");
  });

  it("rejects an unpriced course (unitPrice 0)", () => {
    const r = quote(10, 0);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("course_not_priced");
  });

  it("rounds to cents (no float dust)", () => {
    // 33 × 100 × 0.80 = 2640 exactly; use a price that would dust otherwise.
    const r = computePackPriceQuote({
      unitPriceUsd: 99.99,
      seatCount: 10,
      tiers: TIERS,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // 10 × 99.99 × 0.90 = 899.91
    expect(r.quote.totalPriceUsd).toBe(899.91);
  });
});
