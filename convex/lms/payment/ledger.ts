/**
 * LMS — Revenue-share ledger (Sprint 2 Phase P0.6).
 *
 * One lmsRevenueShares row per APPROVED payment. The 80/20 split is locked
 * (SDD §3.3): Carbono14 takes 20% of the USD gross, Zephyra 80%. `payoutId`
 * stays null until the manual monthly reconciliation (Opción B) stamps it.
 *
 * internalMutation ONLY — there is no client-facing path to mint ledger rows.
 * Called exclusively from the webhook's processVerifiedPayment transaction
 * (convex/lms/payment/internal.ts) on the approved branch.
 *
 * Idempotency: the caller guards on lmsPayments.mpPaymentId before this runs,
 * so a single payment yields a single ledger row. As defense-in-depth this
 * mutation also short-circuits if a ledger row already exists for the payment
 * (by_payment_id), so a re-entrant call can never double-count revenue.
 */

import { internalMutation } from "../../_generated/server";
import { v } from "convex/values";
import {
  computeRevenueSplitUsd,
  currentPeriodYYYYMM,
  sumMercadoPagoFees,
} from "./validation";

export const recordRevenueShare = internalMutation({
  args: {
    paymentId: v.id("lmsPayments"),
    grossUsd: v.number(),
    grossArs: v.number(),
    // MP fee breakdown carried through from fetchPaymentState; optional.
    feeDetails: v.optional(
      v.array(v.object({ type: v.string(), amount: v.number() }))
    ),
  },
  handler: async (ctx, args) => {
    // Defense-in-depth idempotency: never write a second ledger row for the
    // same payment, even if the approved branch is somehow re-entered.
    const existing = await ctx.db
      .query("lmsRevenueShares")
      .withIndex("by_payment_id", (q) => q.eq("paymentId", args.paymentId))
      .first();
    if (existing) {
      return existing._id;
    }

    const { c14CutUsd, zephyraCutUsd } = computeRevenueSplitUsd(args.grossUsd);
    const mpFees = sumMercadoPagoFees(args.feeDetails);
    const now = Date.now();

    return await ctx.db.insert("lmsRevenueShares", {
      paymentId: args.paymentId,
      grossUsd: args.grossUsd,
      grossArs: args.grossArs,
      mpFees: mpFees ?? undefined,
      c14CutUsd,
      zephyraCutUsd,
      period: currentPeriodYYYYMM(now),
      payoutId: undefined, // null until reconciled (manual monthly payout)
      createdAt: now,
    });
  },
});
