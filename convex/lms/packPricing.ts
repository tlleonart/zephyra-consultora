/**
 * LMS — Pack pricing math (Sprint 3a Phase B1 — volume-discount engine).
 *
 * Pure, dependency-free helpers for server-authoritative pack pricing. Kept
 * separate from the Convex runtime (no ctx / db / env / network) so the banding
 * math unit-tests in isolation — mirroring convex/lms/payment/validation.ts.
 *
 * SERVER IS THE ONLY PRICING AUTHORITY (SDD commercial §9.x, anti-tamper #5):
 *   The client NEVER sends a price or a discount. It sends only (courseId,
 *   seatCount). The server looks up the course list price + the volume tier and
 *   computes the total here. The pack checkout snapshots THIS total onto the
 *   order; the webhook anti-tamper validates the settled amount against it.
 *
 * Banding (config-driven via lmsVolumeDiscountTiers, NOT hardcoded):
 *   1–9   → 0%,  selfCheckout: true
 *   10–24 → 10%, selfCheckout: true
 *   25–49 → 20%, selfCheckout: true
 *   50+   → custom, selfCheckout: false ("Contactanos" — checkout REJECTS)
 * The tier whose [minSeats, maxSeats] band contains seatCount applies. The top
 * band has maxSeats null (open-ended).
 */

/** A volume-discount tier row (the slice the pricing math reads). */
export interface VolumeTier {
  minSeats: number;
  maxSeats?: number | null;
  discountPct: number;
  selfCheckout: boolean;
}

/** Server-computed pack quote. The client renders it; it never produces it. */
export interface PackPriceQuote {
  seatCount: number;
  /** Per-seat list price (USD) BEFORE the volume discount. */
  unitPriceUsd: number;
  /** The volume-tier discount applied (0–100). */
  appliedDiscountPct: number;
  /** seatCount × unitPriceUsd × (1 − appliedDiscountPct/100), rounded to cents. */
  totalPriceUsd: number;
  /** false ⇒ band requires "Contactanos"; checkout must reject self-serve. */
  selfCheckoutAllowed: boolean;
}

/** Round to 2 decimals — avoids float dust in money figures (matches ledger). */
const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Select the volume tier that applies to `seatCount`.
 *
 * The matching tier is the one whose band contains seatCount: minSeats ≤
 * seatCount AND (maxSeats == null OR seatCount ≤ maxSeats). Tiers are sorted by
 * minSeats descending so the FIRST match is the most specific band; an
 * open-ended top band (maxSeats null) catches everything at/above its floor.
 * Returns null when no tier matches (e.g. seatCount below the lowest floor) —
 * the caller treats that as "not purchasable".
 */
export function selectVolumeTier(
  tiers: VolumeTier[],
  seatCount: number
): VolumeTier | null {
  const sorted = [...tiers].sort((a, b) => b.minSeats - a.minSeats);
  for (const tier of sorted) {
    const aboveFloor = seatCount >= tier.minSeats;
    const belowCeil =
      tier.maxSeats === null ||
      tier.maxSeats === undefined ||
      seatCount <= tier.maxSeats;
    if (aboveFloor && belowCeil) return tier;
  }
  return null;
}

/**
 * Compute the server-authoritative pack quote.
 *
 * @param unitPriceUsd  the course's list price per seat (USD), from lmsCourses
 * @param seatCount     the requested seat count (must be a positive integer)
 * @param tiers         the lmsVolumeDiscountTiers config rows
 *
 * Returns a discriminated result: ok:false with a reason for an invalid
 * seatCount or no matching tier; ok:true with the full quote otherwise. The
 * quote carries selfCheckoutAllowed=false for the 50+ band — the checkout path
 * rejects on that flag (the UI shows "Contactanos").
 */
export function computePackPriceQuote(args: {
  unitPriceUsd: number;
  seatCount: number;
  tiers: VolumeTier[];
}):
  | { ok: true; quote: PackPriceQuote }
  | { ok: false; reason: string } {
  const { unitPriceUsd, seatCount, tiers } = args;

  if (!Number.isInteger(seatCount) || seatCount < 1) {
    return { ok: false, reason: "seat_count_invalid" };
  }
  if (!(unitPriceUsd > 0)) {
    return { ok: false, reason: "course_not_priced" };
  }

  const tier = selectVolumeTier(tiers, seatCount);
  if (!tier) {
    return { ok: false, reason: "no_matching_tier" };
  }

  const discountPct = tier.discountPct;
  const totalPriceUsd = round2(
    seatCount * unitPriceUsd * (1 - discountPct / 100)
  );

  return {
    ok: true,
    quote: {
      seatCount,
      unitPriceUsd,
      appliedDiscountPct: discountPct,
      totalPriceUsd,
      selfCheckoutAllowed: tier.selfCheckout,
    },
  };
}

/**
 * The canonical V1 seed bands (SDD commercial §9.x). The seed mutation inserts
 * these idempotently; the pricing math reads them from the DB (never these
 * constants directly) so Zephyra can retune bands without a code change. The
 * 50+ band's discountPct is a placeholder (negotiated per deal); the decisive
 * field is selfCheckout:false, which cuts the self-serve path.
 */
export const SEED_VOLUME_TIERS: ReadonlyArray<Omit<VolumeTier, "maxSeats"> & {
  maxSeats: number | null;
}> = [
  { minSeats: 1, maxSeats: 9, discountPct: 0, selfCheckout: true },
  { minSeats: 10, maxSeats: 24, discountPct: 10, selfCheckout: true },
  { minSeats: 25, maxSeats: 49, discountPct: 20, selfCheckout: true },
  { minSeats: 50, maxSeats: null, discountPct: 0, selfCheckout: false },
];
