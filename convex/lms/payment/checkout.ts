/**
 * LMS — Checkout action (Sprint 2 Phase P1.2 — checkout flow).
 *
 * createCheckout is a Convex ACTION (not a mutation) by necessity: it does
 * outbound HTTP to MercadoPago (POST /checkout/preferences) and reads the MP
 * credentials from env — both of which are ONLY allowed in an action /
 * httpAction, never a query/mutation. All DB work is delegated to the internal
 * order mutations/queries (actions have no ctx.db).
 *
 * TRUST CONTRACT (mirrors getMyEnrollment / setLearnerPassword in this repo):
 *   The caller is the Next.js server action layer, which has ALREADY validated
 *   the `session-learner` cookie via getLearnerSession() and is passing the
 *   resulting learnerId. Convex actions cannot read cookies, so learnerId is a
 *   trusted boundary input here — the surface-layer gate is the auth check.
 *   The blast radius of a forged learnerId is bounded: the attacker can open a
 *   checkout that, on payment, enrolls THAT learnerId (which they'd have to own
 *   to access) — they cannot grant themselves an entitlement.
 *
 * Flow:
 *   1. Resolve the learner (email for the MP payer prefill).
 *   2. Guard: no checkout if the learner already has an active enrollment.
 *   3. Resolve the course server-side (authoritative price + purchasable gate).
 *   4. Reuse an in-flight pending order for (learner, course) — double-click
 *      idempotency — else create one.
 *   5. Open the MP preference; stamp the preference id onto the order.
 *   6. Return the redirectUrl (MP Checkout Pro init_point).
 */

import { action } from "../../_generated/server";
import { api, internal } from "../../_generated/api";
import { v } from "convex/values";
import { logMoney } from "./logging";
import { MercadoPagoAdapter } from "./mercadopago";

export const createCheckout = action({
  args: {
    learnerId: v.id("lmsCustomers"),
    courseId: v.id("lmsCourses"),
  },
  handler: async (ctx, args): Promise<{ redirectUrl: string }> => {
    // --- 1. Resolve the learner (email for the MP payer) --------------------
    const learner = await ctx.runQuery(api.lms.auth.getLearnerById, {
      learnerId: args.learnerId,
    });
    if (!learner) {
      throw new Error("Learner no encontrado");
    }

    // --- 2. Guard: already enrolled -----------------------------------------
    const existingEnrollment = await ctx.runQuery(
      api.lms.enrollments.getMyEnrollment,
      { learnerId: args.learnerId, courseId: args.courseId }
    );
    if (existingEnrollment) {
      throw new Error("Ya tenés acceso a este curso");
    }

    // --- 3. Resolve the course (authoritative price + purchasable gate) -----
    const course = await ctx.runQuery(
      internal.lms.courses.getCourseForCheckout,
      { courseId: args.courseId }
    );
    if (!course) {
      throw new Error("Curso no disponible para compra");
    }

    // --- 4. Reuse a pending order or create one (double-click idempotency) --
    let order = await ctx.runQuery(internal.lms.payment.orders.getPendingOrder, {
      customerId: args.learnerId,
      courseId: args.courseId,
    });
    if (!order) {
      order = await ctx.runMutation(internal.lms.payment.orders.createOrder, {
        customerId: args.learnerId,
        courseId: args.courseId,
        priceUsd: course.priceUsd,
      });
    }

    // --- 5. Open the MP preference ------------------------------------------
    // Adapter construction validates MP env credentials are present.
    const adapter = new MercadoPagoAdapter();
    const { externalId, redirectUrl } = await adapter.createCheckoutSession({
      orderId: order._id,
      customerId: args.learnerId,
      courseId: args.courseId,
      priceUsd: course.priceUsd,
      currency: "USD",
      payerEmail: learner.email,
      courseTitle: course.title,
      courseSlug: course.slug,
    });

    await ctx.runMutation(
      internal.lms.payment.orders.updateOrderWithMpPreference,
      { orderId: order._id, mpPreferenceId: externalId }
    );

    logMoney("info", "checkout_preference_created", "MP Checkout Pro preference created", {
      orderId: order._id,
      externalReference: order._id,
      mpPreferenceId: externalId,
      learnerId: args.learnerId,
      courseId: args.courseId,
      amountUsd: course.priceUsd,
      currency: "USD",
    });

    // --- 6. Return the Checkout Pro redirect --------------------------------
    return { redirectUrl };
  },
});

/**
 * createPackCheckout — the B2B pack checkout path (Sprint 3a Phase B2).
 *
 * The org-owner-gated sibling of createCheckout. An action (outbound HTTP to MP
 * + env access). Owner-gated, server-authoritative pricing, retry-reuse, 50+
 * rejection. The client sends ONLY (callerCustomerId, organizationId, courseId,
 * seatCount) — NEVER a price. Any client-supplied price would be impossible to
 * pass here (the arg doesn't exist) and is recomputed regardless.
 *
 * Flow:
 *   1. requireOrgOwner gate (via internalQuery) — fails closed for any non-owner.
 *      This is the cross-org isolation control (Risk R3); a forged caller can
 *      only ever open a checkout for an org they actually own.
 *   2. Resolve the course server-side (authoritative per-seat price + purchasable).
 *   3. RECOMPUTE the pack total server-side from the volume tiers. Reject the
 *      50+ band (selfCheckoutAllowed:false → "Contactanos") and any invalid quote.
 *   4. Reuse an OPEN pending_payment pack order for (org, course) on retry, else
 *      snapshot a fresh pack order (orderType "pack" + the server pricing).
 *   5. Open the MP Checkout Pro preference in USD; stamp the preference id.
 *   6. Return { redirectUrl, orderId } — the return pages read order status from
 *      the DB (reusing the S2 /compra/{exito|error|pendiente} pattern).
 */
export const createPackCheckout = action({
  args: {
    callerCustomerId: v.id("lmsCustomers"),
    organizationId: v.id("lmsOrganizations"),
    courseId: v.id("lmsCourses"),
    seatCount: v.number(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ redirectUrl: string; orderId: string }> => {
    // --- 1. Owner gate (fails closed for any non-owner) ---------------------
    // assertOrgOwner throws AuthError if the caller is not the org's owner.
    const { ownerEmail } = await ctx.runQuery(
      internal.lms.org.assertOrgOwner,
      {
        callerCustomerId: args.callerCustomerId,
        organizationId: args.organizationId,
      }
    );

    // --- 2. Resolve the course (authoritative per-seat price + gate) --------
    const course = await ctx.runQuery(
      internal.lms.packs.getCourseForPackCheckout,
      { courseId: args.courseId }
    );
    if (!course) {
      throw new Error("Curso no disponible para compra");
    }

    // --- 3. RECOMPUTE the pack total server-side (ignore any client price) --
    const quoteResult = await ctx.runQuery(
      internal.lms.packs.quotePackPriceInternal,
      { unitPriceUsd: course.priceUsd, seatCount: args.seatCount }
    );
    if (!quoteResult.ok) {
      throw new Error(`Cantidad de seats inválida: ${quoteResult.reason}`);
    }
    const quote = quoteResult.quote;
    // 50+ band: no self-serve checkout — the UI shows "Contactanos".
    if (!quote.selfCheckoutAllowed) {
      throw new Error(
        "Para 50 o más seats, contactanos para una cotización personalizada"
      );
    }

    // --- 4. Reuse an open pending pack order or snapshot a fresh one ---------
    let order = await ctx.runQuery(internal.lms.packs.getOpenPackOrder, {
      organizationId: args.organizationId,
      courseId: args.courseId,
    });
    if (!order) {
      order = await ctx.runMutation(internal.lms.packs.createPackOrder, {
        organizationId: args.organizationId,
        customerId: args.callerCustomerId,
        courseId: args.courseId,
        seatCount: quote.seatCount,
        unitPriceUsd: quote.unitPriceUsd,
        appliedDiscountPct: quote.appliedDiscountPct,
        totalPriceUsd: quote.totalPriceUsd,
      });
    }

    // --- 5. Open the MP preference (USD) ------------------------------------
    const adapter = new MercadoPagoAdapter();
    const { externalId, redirectUrl } = await adapter.createCheckoutSession({
      orderId: order._id,
      customerId: args.callerCustomerId,
      courseId: args.courseId,
      priceUsd: order.priceUsd, // the SERVER pack total
      currency: "USD",
      payerEmail: ownerEmail,
      courseTitle: `${course.title} — ${quote.seatCount} licencias`,
      courseSlug: course.slug,
    });

    await ctx.runMutation(
      internal.lms.packs.updatePackOrderWithMpPreference,
      { orderId: order._id, mpPreferenceId: externalId }
    );

    logMoney(
      "info",
      "pack_checkout_preference_created",
      "MP Checkout Pro preference created for pack order",
      {
        orderId: order._id,
        externalReference: order._id,
        mpPreferenceId: externalId,
        organizationId: args.organizationId,
        courseId: args.courseId,
        seatCount: quote.seatCount,
        amountUsd: order.priceUsd,
        currency: "USD",
      }
    );

    return { redirectUrl, orderId: order._id };
  },
});
