/**
 * LMS — Seat-pack domain (Sprint 3a Phase B1–B3).
 *
 * The B2B money path: an organization buys a pack of seats for ONE course at a
 * volume-discounted price, the payment settles via the SAME MercadoPago webhook
 * spine as B2C, and the approved branch MINTS the pack + its seats (instead of
 * granting a B2C enrollment). Seats are later claimed to org_learners (3b).
 *
 * Contents:
 *   B1  seedVolumeDiscountTiers  — idempotent config seed (internalMutation)
 *       computePackPrice         — server-authoritative quote (PUBLIC query)
 *   B2  getCourseForPackCheckout — course price + purchasable gate (internalQuery)
 *       getOpenPackOrder         — retry reuse of a pending pack order (internalQuery)
 *       createPackOrder          — snapshot the pack order (internalMutation)
 *   B3  mintSeatPackForOrder     — idempotent pack + seat mint (internalMutation)
 *
 * SECURITY INVARIANTS (money path):
 *   - The client NEVER sends a price. computePackPrice + createPackOrder recompute
 *     the total server-side from lmsCourses.priceUsd × seatCount × tier discount.
 *   - 50+ band (selfCheckout:false) is REJECTED on the checkout path ("Contactanos").
 *   - Pack/seat/order-price are minted ONLY in internalMutations reached from the
 *     gated checkout action and the webhook — no client-facing entry point.
 *   - mintSeatPackForOrder is IDEMPOTENT: keyed on orderId via lmsSeatPacks.by_order,
 *     a replayed approved webhook mints exactly ONE pack + exactly seatCount seats.
 */

import { internalMutation, internalQuery, query } from "../_generated/server";
import { v } from "convex/values";
import { logMoney } from "./payment/logging";
import {
  computePackPriceQuote,
  SEED_VOLUME_TIERS,
  type VolumeTier,
} from "./packPricing";

// ============================================================================
// B1 — seedVolumeDiscountTiers (idempotent config seed)
// ============================================================================
//
// internalMutation: seeds the canonical V1 volume bands. Idempotent — it checks
// each band by its minSeats floor (lmsVolumeDiscountTiers.by_min_seats) before
// inserting, so re-running it never duplicates a band. Re-runnable as a migration
// step. Zephyra can later edit the rows directly to retune bands without code.
export const seedVolumeDiscountTiers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let inserted = 0;
    for (const tier of SEED_VOLUME_TIERS) {
      const existing = await ctx.db
        .query("lmsVolumeDiscountTiers")
        .withIndex("by_min_seats", (q) => q.eq("minSeats", tier.minSeats))
        .first();
      if (existing) continue;
      await ctx.db.insert("lmsVolumeDiscountTiers", {
        minSeats: tier.minSeats,
        maxSeats: tier.maxSeats ?? undefined,
        discountPct: tier.discountPct,
        selfCheckout: tier.selfCheckout,
        createdAt: now,
      });
      inserted += 1;
    }
    return { inserted };
  },
});

// Internal helper: load the configured tiers as plain VolumeTier objects for the
// pure pricing math. Reads the whole (tiny, ~4-row) config table.
async function loadVolumeTiers(ctx: {
  db: { query: (t: "lmsVolumeDiscountTiers") => { collect: () => Promise<unknown[]> } };
}): Promise<VolumeTier[]> {
  const rows = (await ctx.db
    .query("lmsVolumeDiscountTiers")
    .collect()) as Array<{
    minSeats: number;
    maxSeats?: number;
    discountPct: number;
    selfCheckout: boolean;
  }>;
  return rows.map((r) => ({
    minSeats: r.minSeats,
    maxSeats: r.maxSeats ?? null,
    discountPct: r.discountPct,
    selfCheckout: r.selfCheckout,
  }));
}

// ============================================================================
// B1 — computePackPrice (server-authoritative quote)
// ============================================================================
//
// PUBLIC query. The catalog/pack UI calls this with (courseId, seatCount) to
// render a live quote. The server is the ONLY pricing authority — the client
// passes NO price and NO discount. Returns the full quote OR a not-available
// shape (course not priced, invalid seatCount, no matching tier). For the 50+
// band it returns selfCheckoutAllowed:false so the UI shows "Contactanos"; the
// checkout path independently re-rejects that band (defense in depth).
//
// Read-only and self-contained: a quote leaks only the course's already-public
// list price math, so no auth gate is required to PRICE. Actually PURCHASING is
// gated by requireOrgOwner on the checkout path.
export const computePackPrice = query({
  args: {
    courseId: v.id("lmsCourses"),
    seatCount: v.number(),
  },
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.courseId);
    if (
      !course ||
      course.deletedAt ||
      course.status !== "published" ||
      course.isPurchasable !== true ||
      typeof course.priceUsd !== "number" ||
      !(course.priceUsd > 0)
    ) {
      return { available: false as const, reason: "course_not_available" };
    }

    const tiers = await loadVolumeTiers(ctx);
    const result = computePackPriceQuote({
      unitPriceUsd: course.priceUsd,
      seatCount: args.seatCount,
      tiers,
    });

    if (!result.ok) {
      return { available: false as const, reason: result.reason };
    }

    return {
      available: true as const,
      courseId: course._id,
      courseTitle: course.title,
      ...result.quote,
    };
  },
});

// ============================================================================
// B2 — getCourseForPackCheckout (course price + purchasable gate)
// ============================================================================
//
// internalQuery used by the pack checkout action. Returns the authoritative
// per-seat list price + the title/slug the MP preference + return pages need.
// Same gate as the B2C getCourseForCheckout: published + purchasable + priced.
export const getCourseForPackCheckout = internalQuery({
  args: { courseId: v.id("lmsCourses") },
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.courseId);
    if (!course || course.deletedAt) return null;
    if (course.status !== "published") return null;
    if (course.isPurchasable !== true) return null;
    if (typeof course.priceUsd !== "number" || !(course.priceUsd > 0)) {
      return null;
    }
    return {
      _id: course._id,
      title: course.title,
      slug: course.slug,
      priceUsd: course.priceUsd,
    };
  },
});

// ============================================================================
// B2 — quotePackPriceInternal (server recompute for the checkout action)
// ============================================================================
//
// internalQuery: the checkout action recomputes the price server-side (ignoring
// any client-sent value) right before snapshotting the order. Returns the same
// discriminated quote as computePackPrice's pricing core but as an internal
// surface the action trusts.
export const quotePackPriceInternal = internalQuery({
  args: {
    unitPriceUsd: v.number(),
    seatCount: v.number(),
  },
  handler: async (ctx, args) => {
    const tiers = await loadVolumeTiers(ctx);
    return computePackPriceQuote({
      unitPriceUsd: args.unitPriceUsd,
      seatCount: args.seatCount,
      tiers,
    });
  },
});

// ============================================================================
// B2 — getOpenPackOrder (retry reuse of a pending pack order)
// ============================================================================
//
// internalQuery. On a checkout retry for the SAME (organizationId, courseId), we
// reuse an existing open `pending_payment` pack order rather than spawning a
// second one — the pack analogue of the B2C double-click guard. Uses the
// dedicated by_org_course_status index (no full scan).
export const getOpenPackOrder = internalQuery({
  args: {
    organizationId: v.id("lmsOrganizations"),
    courseId: v.id("lmsCourses"),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("lmsOrders")
      .withIndex("by_org_course_status", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("courseId", args.courseId)
          .eq("status", "pending_payment")
      )
      .first();
    if (!order || order.deletedAt) return null;
    // Defensive: only reuse a row that is actually a pack order.
    if (order.orderType !== "pack") return null;
    return order;
  },
});

// ============================================================================
// B2 — cancelPackOrder (supersede a stale pending pack order)
// ============================================================================
//
// internalMutation. Used by the checkout action when a reusable open pack order
// is found whose snapshot (seatCount / total) NO LONGER matches the freshly
// recomputed quote (e.g. the buyer abandoned a 10-seat order and returned to buy
// 25). We mark the stale order `cancelled` so it can never be paid later (a
// late MP approval for a superseded preference must NOT mint the old seatCount),
// then snapshot a fresh order at the current quote. Only acts on a still-open
// `pending_payment` pack order; idempotent / no-op otherwise.
export const cancelPackOrder = internalMutation({
  args: { orderId: v.id("lmsOrders") },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order || order.deletedAt) return { cancelled: false as const };
    if (order.orderType !== "pack" || order.status !== "pending_payment") {
      return { cancelled: false as const };
    }
    await ctx.db.patch(args.orderId, {
      status: "cancelled",
      updatedAt: Date.now(),
    });
    logMoney("info", "pack_order_superseded", "Stale pending pack order cancelled (quote mismatch)", {
      orderId: args.orderId,
      organizationId: order.organizationId,
      courseId: order.courseId,
      seatCount: order.seatCount,
      amountUsd: order.priceUsd,
    });
    return { cancelled: true as const };
  },
});

// ============================================================================
// B2 — createPackOrder (snapshot the server-computed pack order)
// ============================================================================
//
// internalMutation ONLY (no client-minted pack orders). Snapshots the
// server-authoritative pricing onto the order: orderType "pack",
// organizationId, seatCount, unitPriceUsd (list, pre-discount),
// appliedDiscountPct, and priceUsd = the server total. externalReference is
// patched to the row's own _id so the webhook's by_external_reference lookup
// resolves it (identical bridge to the B2C createOrder).
//
// The caller (the gated checkout action) has ALREADY recomputed and validated
// the total server-side; this mutation re-asserts the total is positive as a
// last-line guard, but it does NOT trust any client price (the action never
// forwards one).
export const createPackOrder = internalMutation({
  args: {
    organizationId: v.id("lmsOrganizations"),
    customerId: v.id("lmsCustomers"),
    courseId: v.id("lmsCourses"),
    seatCount: v.number(),
    unitPriceUsd: v.number(),
    appliedDiscountPct: v.number(),
    totalPriceUsd: v.number(),
  },
  handler: async (ctx, args) => {
    if (!(args.totalPriceUsd > 0)) {
      throw new Error("createPackOrder: totalPriceUsd must be positive");
    }
    if (!Number.isInteger(args.seatCount) || args.seatCount < 1) {
      throw new Error("createPackOrder: seatCount must be a positive integer");
    }

    const now = Date.now();
    const orderId = await ctx.db.insert("lmsOrders", {
      customerId: args.customerId,
      courseId: args.courseId,
      priceUsd: args.totalPriceUsd, // server total — anti-tamper anchor
      status: "pending_payment",
      externalReference: "", // patched to own _id below
      orderType: "pack",
      organizationId: args.organizationId,
      seatCount: args.seatCount,
      unitPriceUsd: args.unitPriceUsd,
      appliedDiscountPct: args.appliedDiscountPct,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(orderId, { externalReference: orderId });

    const order = await ctx.db.get(orderId);
    if (!order) {
      throw new Error("createPackOrder: failed to read back inserted order");
    }

    logMoney("info", "pack_order_created", "Pending pack order created", {
      orderId,
      externalReference: orderId,
      organizationId: args.organizationId,
      courseId: args.courseId,
      seatCount: args.seatCount,
      amountUsd: args.totalPriceUsd,
    });
    return order;
  },
});

// ============================================================================
// B2 — updatePackOrderWithMpPreference
// ============================================================================
//
// Stamps the MP preference id onto a pack order. Mirrors the B2C
// updateOrderWithMpPreference; does NOT change status (status only advances on
// the authoritative webhook).
export const updatePackOrderWithMpPreference = internalMutation({
  args: {
    orderId: v.id("lmsOrders"),
    mpPreferenceId: v.string(),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order || order.deletedAt) {
      throw new Error(
        `updatePackOrderWithMpPreference: order not found: ${args.orderId}`
      );
    }
    await ctx.db.patch(args.orderId, {
      mpPreferenceId: args.mpPreferenceId,
      updatedAt: Date.now(),
    });
  },
});

// ============================================================================
// B3 — mintSeatPackForOrder (MONEY PATH — idempotent pack + seat mint)
// ============================================================================
//
// internalMutation ONLY — there is NO client-facing path to mint a pack or a
// seat. Called EXCLUSIVELY from the webhook's processVerifiedPayment transaction
// (convex/lms/payment/internal.ts) on the APPROVED branch when the order is a
// pack (orderType === "pack"). The B2B analogue of grantEnrollmentForOrder.
//
// IDEMPOTENCY (the load-bearing money-path control): keyed on orderId via
// lmsSeatPacks.by_order. A duplicate / replayed approved webhook for the same
// payment is already short-circuited upstream by the lmsPayments.by_mp_payment_id
// dedupe; this lookup-before-insert is the second, structural guarantee — even
// if this mutation were re-entered for the same orderId, it returns the existing
// pack and mints NOTHING. Result: exactly ONE lmsSeatPacks row + exactly
// seatCount lmsSeats rows per paid pack order, forever.
//
// Balance invariant holds from creation: availableSeats(=seatCount) +
// claimedSeats(=0) ≤ totalSeats(=seatCount). expiresAt is null (vitalicias, V1).
export const mintSeatPackForOrder = internalMutation({
  args: { orderId: v.id("lmsOrders") },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order || order.deletedAt) {
      throw new Error(`mintSeatPackForOrder: order not found: ${args.orderId}`);
    }
    if (order.orderType !== "pack") {
      throw new Error(
        `mintSeatPackForOrder: order ${args.orderId} is not a pack order`
      );
    }
    if (!order.organizationId) {
      throw new Error(
        `mintSeatPackForOrder: pack order ${args.orderId} has no organizationId`
      );
    }
    const seatCount = order.seatCount;
    if (typeof seatCount !== "number" || !Number.isInteger(seatCount) || seatCount < 1) {
      throw new Error(
        `mintSeatPackForOrder: pack order ${args.orderId} has invalid seatCount`
      );
    }

    // IDEMPOTENCY: lookup-before-insert on orderId (by_order). A replayed
    // approved webhook finds the existing pack and mints nothing more.
    const existing = await ctx.db
      .query("lmsSeatPacks")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .first();
    if (existing) {
      logMoney(
        "info",
        "seat_pack_mint_idempotent_noop",
        "Seat pack already minted for order; idempotent no-op",
        {
          orderId: args.orderId,
          organizationId: order.organizationId,
          seatPackId: existing._id,
          seatCount,
        }
      );
      return { seatPackId: existing._id, minted: false, seatsMinted: 0 };
    }

    const now = Date.now();
    const seatPackId = await ctx.db.insert("lmsSeatPacks", {
      orderId: args.orderId,
      organizationId: order.organizationId,
      courseId: order.courseId,
      totalSeats: seatCount,
      availableSeats: seatCount, // all seats start unclaimed
      claimedSeats: 0,
      validFrom: now,
      expiresAt: undefined, // vitalicias in V1 (ADR-0013)
      createdAt: now,
    });

    // Mint exactly seatCount seats, all "available", unclaimed.
    for (let i = 0; i < seatCount; i++) {
      await ctx.db.insert("lmsSeats", {
        seatPackId,
        status: "available",
        claimedBy: undefined,
        claimedAt: undefined,
        claimRequestId: undefined,
        createdAt: now,
      });
    }

    logMoney("info", "seat_pack_minted", "Seat pack + seats minted for paid pack order", {
      orderId: args.orderId,
      organizationId: order.organizationId,
      courseId: order.courseId,
      seatPackId,
      seatCount,
    });

    return { seatPackId, minted: true, seatsMinted: seatCount };
  },
});
