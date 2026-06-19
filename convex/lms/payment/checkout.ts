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
