/**
 * Unit test for the USD price formatter (Sprint 2 P1.5).
 * Orders are always priced in USD (SDD §9.4); the catalog renders the canonical
 * list price. We assert integer prices drop decimals and fractional prices keep
 * two, with the US$ prefix the catalog expects.
 */
import { describe, it, expect } from "vitest";
import { formatUsd } from "../../../src/features/lms-checkout/lib/format-price";

describe("formatUsd", () => {
  it("renders an integer price without decimals", () => {
    expect(formatUsd(90)).toBe("US$ 90");
  });

  it("renders a fractional price with two decimals", () => {
    expect(formatUsd(1499.5)).toBe("US$ 1.499,50");
  });

  it("prefixes with US$", () => {
    expect(formatUsd(10).startsWith("US$ ")).toBe(true);
  });
});
