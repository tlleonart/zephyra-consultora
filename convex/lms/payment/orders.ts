/**
 * LMS — Order helpers (Sprint 2 Phase P1 — checkout flow).
 *
 * The checkout action (convex/lms/payment/checkout.ts) needs to create/reuse an
 * order, then stamp it with the MercadoPago preference id. Those DB touches live
 * here as internalMutation / internalQuery — actions have no ctx.db and must
 * delegate. Order creation is INTERNAL-only: the only client-facing entry point
 * is the gated `createCheckout` action, never a raw "make me an order" mutation.
 *
 * `externalReference` is the bridge the inbound webhook uses to map an MP payment
 * back to our order (by_external_reference). We set it to the order's own _id —
 * stable, unique, and already echoed verbatim by MP via the preference's
 * external_reference. Because Convex assigns the _id at insert time, we insert a
 * placeholder then patch externalReference = _id in the same transaction.
 *
 * `getOrderById` is the ONE public query here: the return pages read the order
 * straight from the DB rather than trusting the success/failure/pending query
 * string MercadoPago appended (DB is truth — the back_url is just a UX hint).
 */

import { internalMutation, internalQuery, query } from "../../_generated/server";
import { v } from "convex/values";
import { logMoney } from "./logging";

// ============================================================================
// getPendingOrder — reuse an in-flight checkout (double-click idempotency)
// ============================================================================
//
// A learner who double-clicks "Comprar" (or returns to the detail page and
// clicks again before paying) must NOT spawn a second pending order. We collapse
// on the (customer, course, pending_payment) tuple via by_learner_course_status.
export const getPendingOrder = internalQuery({
  args: {
    customerId: v.id("lmsCustomers"),
    courseId: v.id("lmsCourses"),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("lmsOrders")
      .withIndex("by_learner_course_status", (q) =>
        q
          .eq("customerId", args.customerId)
          .eq("courseId", args.courseId)
          .eq("status", "pending_payment")
      )
      .first();
    if (!order || order.deletedAt) return null;
    return order;
  },
});

// ============================================================================
// createOrder — mint a fresh pending_payment order
// ============================================================================
//
// internalMutation ONLY (no client-minted orders). externalReference is patched
// to the row's own _id immediately after insert so the webhook's
// by_external_reference lookup resolves it. Returns the full row so the action
// can read _id + priceUsd without a follow-up query.
export const createOrder = internalMutation({
  args: {
    customerId: v.id("lmsCustomers"),
    courseId: v.id("lmsCourses"),
    priceUsd: v.number(),
  },
  handler: async (ctx, args) => {
    if (!(args.priceUsd > 0)) {
      throw new Error("createOrder: priceUsd must be positive");
    }
    const now = Date.now();
    const orderId = await ctx.db.insert("lmsOrders", {
      customerId: args.customerId,
      courseId: args.courseId,
      priceUsd: args.priceUsd,
      status: "pending_payment",
      // Placeholder; patched to the row's own _id below so MP echoes a value
      // our by_external_reference index can resolve on the inbound webhook.
      externalReference: "",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(orderId, { externalReference: orderId });

    const order = await ctx.db.get(orderId);
    if (!order) {
      // insert+get round-trip cannot miss in a single transaction; defensive.
      throw new Error("createOrder: failed to read back inserted order");
    }
    logMoney("info", "order_created", "Pending order created", {
      orderId,
      externalReference: orderId,
      learnerId: args.customerId,
      courseId: args.courseId,
      amountUsd: args.priceUsd,
    });
    return order;
  },
});

// ============================================================================
// updateOrderWithMpPreference — stamp the MP preference id onto the order
// ============================================================================
//
// Records the preference id returned by createCheckoutSession so the order can
// be cross-referenced against MP's dashboard. Does NOT change status (status
// only advances on the authoritative webhook).
export const updateOrderWithMpPreference = internalMutation({
  args: {
    orderId: v.id("lmsOrders"),
    mpPreferenceId: v.string(),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order || order.deletedAt) {
      throw new Error(
        `updateOrderWithMpPreference: order not found: ${args.orderId}`
      );
    }
    await ctx.db.patch(args.orderId, {
      mpPreferenceId: args.mpPreferenceId,
      updatedAt: Date.now(),
    });
  },
});

// ============================================================================
// getOrderById — return-page status read (DB is truth)
// ============================================================================
//
// PUBLIC query. The compra/{exito,error,pendiente} pages read the REAL order
// status from here rather than trusting the back_url path MP redirected to. We
// expose only the fields the return UI needs — no payment internals, no
// webhookEventLog. The order _id is an unguessable Convex id, and the row holds
// no PII (customerId is an opaque id, not an email), so an unauthenticated read
// by id is acceptable; the worst exposure is "this order is paid/pending" to
// someone who already holds the (un-enumerable) order id.
export const getOrderById = query({
  args: { orderId: v.id("lmsOrders") },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order || order.deletedAt) return null;
    return {
      _id: order._id,
      courseId: order.courseId,
      status: order.status,
      priceUsd: order.priceUsd,
    };
  },
});
