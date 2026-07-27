/**
 * LMS — Money-path internal mutations (Sprint 2 Phase P0).
 *
 * The webhook arrives at an httpAction (convex/lms/payment/webhook.ts).
 * httpActions are NOT transactional and have no ctx.db — they can only
 * verify the signature + fetch authoritative state, then delegate the DB work
 * to an internalMutation. This file IS that transactional boundary.
 *
 * WHY one mutation does dedupe + insert + enroll + ledger together:
 *   Idempotency (SDD §7 signed control #3 — "dup webhook = exactly 1 payment +
 *   1 enrollment") can only be GUARANTEED inside a single Convex transaction.
 *   If the dedupe read and the insert ran in the (non-transactional) action,
 *   two near-simultaneous webhook deliveries for the same payment could both
 *   pass the "not seen yet" check and both insert. Doing the check + all writes
 *   in ONE mutation means Convex's per-transaction serializability is the
 *   structural guarantee, not a hopeful read-then-write in the action.
 *
 * internalMutation / internalQuery ONLY — no client-facing entry point mints
 * payments, enrollments, or ledger rows (signed control #6).
 */

import { internal } from "../../_generated/api";
import { internalMutation, internalQuery } from "../../_generated/server";
import { v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { logMoney } from "./logging";
import { validateAmountAndCurrency } from "./validation";

/**
 * Discriminated outcome of processVerifiedPayment. The explicit annotation is
 * REQUIRED: the handler calls ctx.runMutation(internal.*) whose inferred return
 * types would otherwise feed back into this function's own inference, which TS
 * cannot resolve (TS7022/7023 "referenced in its own initializer"). Annotating
 * the return breaks the cycle.
 */
type ProcessOutcome =
  | { outcome: "already_processed"; paymentId: Id<"lmsPayments"> }
  | { outcome: "order_not_found"; externalReference: string }
  | { outcome: "amount_mismatch"; reason: string }
  | {
      outcome: "approved";
      paymentId: Id<"lmsPayments">;
      orderId: Id<"lmsOrders">;
      enrollmentId: Id<"lmsEnrollments">;
    }
  | {
      // B2B pack approved: seats are MINTED (a pack + N seats), not enrolled.
      // The org owner later claims seats to learners; no enrollment at payment.
      outcome: "approved_pack";
      paymentId: Id<"lmsPayments">;
      orderId: Id<"lmsOrders">;
      seatPackId: Id<"lmsSeatPacks">;
    }
  | {
      outcome: "rejected" | "cancelled";
      paymentId: Id<"lmsPayments">;
      orderId: Id<"lmsOrders">;
    }
  | { outcome: "pending"; orderId: Id<"lmsOrders"> };

// Reusable validator for the slice of PaymentState the mutation trusts. Only
// fields fetched authoritatively from MP (verify-before-trust) flow in here —
// never the raw webhook body's state/amount fields.
const fetchedPaymentValidator = v.object({
  id: v.string(),
  status: v.union(
    v.literal("approved"),
    v.literal("pending"),
    v.literal("rejected"),
    v.literal("cancelled")
  ),
  amount: v.number(),
  currency: v.string(),
  external_reference: v.string(),
  feeDetails: v.optional(
    v.array(v.object({ type: v.string(), amount: v.number() }))
  ),
});

// The append-only log event the action records for forensic audit.
const eventLogEntryValidator = v.object({
  eventType: v.string(),
  payload: v.any(),
  timestamp: v.number(),
});

/**
 * resolveOrderByExternalReference — internalQuery the action uses to map a
 * fetched payment's external_reference back to our Order. Read-only; the action
 * needs the order's priceUsd to drive its decision logging.
 */
export const resolveOrderByExternalReference = internalQuery({
  args: { externalReference: v.string() },
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("lmsOrders")
      .withIndex("by_external_reference", (q) =>
        q.eq("externalReference", args.externalReference)
      )
      .first();
    if (!order || order.deletedAt) return null;
    return order;
  },
});

/**
 * processVerifiedPayment — the transactional core of the money path.
 *
 * Preconditions enforced UPSTREAM by the httpAction (NOT re-doable here, no
 * network in a mutation):
 *   - x-signature HMAC already verified (control #1)
 *   - state already fetched authoritatively from MP (control #2)
 * This mutation owns, atomically:
 *   (3) IDEMPOTENCY  — dedupe on lmsPayments.by_mp_payment_id
 *   (4) ANTI-TAMPER  — amount/currency validated against the resolved Order
 *   (5) APPROVED     — order→paid, payment row, enrollment, ledger
 *   (6) REJECTED/CXL — order→failed/cancelled, payment row, no entitlement
 *
 * Returns a discriminated outcome so the action can shape its 200 response and
 * its logs without re-reading the DB.
 */
export const processVerifiedPayment = internalMutation({
  args: {
    fetched: fetchedPaymentValidator,
    // Forensic events the action accumulated (received / signature_verified /
    // state_fetched). Appended to webhookEventLog alongside the outcome event.
    priorEvents: v.array(eventLogEntryValidator),
  },
  handler: async (ctx, args): Promise<ProcessOutcome> => {
    const { fetched } = args;
    const now = Date.now();

    // --- (3) IDEMPOTENCY -----------------------------------------------------
    // Single-transaction dedupe on the unique-by-application mpPaymentId. A
    // duplicate delivery sees the existing row and returns with NO side effects.
    const existing = await ctx.db
      .query("lmsPayments")
      .withIndex("by_mp_payment_id", (q) =>
        q.eq("mpPaymentId", fetched.id)
      )
      .first();
    if (existing) {
      return {
        outcome: "already_processed" as const,
        paymentId: existing._id,
      };
    }

    // --- resolve the Order ---------------------------------------------------
    const order = await ctx.db
      .query("lmsOrders")
      .withIndex("by_external_reference", (q) =>
        q.eq("externalReference", fetched.external_reference)
      )
      .first();
    if (!order || order.deletedAt) {
      return {
        outcome: "order_not_found" as const,
        externalReference: fetched.external_reference,
      };
    }

    // --- (4) ANTI-TAMPER -----------------------------------------------------
    const amountCheck = validateAmountAndCurrency({
      orderPriceUsd: order.priceUsd,
      fetchedAmount: fetched.amount,
      fetchedCurrency: fetched.currency,
    });
    if (!amountCheck.ok) {
      return {
        outcome: "amount_mismatch" as const,
        reason: amountCheck.reason,
      };
    }

    // --- (5) APPROVED --------------------------------------------------------
    if (fetched.status === "approved") {
      const paymentId = await ctx.db.insert("lmsPayments", {
        orderId: order._id,
        mpPaymentId: fetched.id,
        status: "approved",
        grossArs: fetched.amount,
        usdAmount: order.priceUsd,
        webhookEventLog: [
          ...args.priorEvents,
          { eventType: "approved", payload: fetched, timestamp: now },
        ],
        lastVerifiedAt: now,
        createdAt: now,
      });

      await ctx.db.patch(order._id, { status: "paid", updatedAt: now });

      // --- ENTITLEMENT BRANCH (Sprint 3a) ----------------------------------
      // Branch on order.orderType. ABSENT ⇒ "b2c" (default-b2c semantics —
      // pre-3a orders carry no orderType). A "pack" order MINTS a seat pack +
      // N seats (idempotent, keyed on orderId); the org owner later claims
      // seats to learners — there is NO enrollment at payment time. recordRevenue
      // Share + the buyer email stay COMMON to both branches below.
      const isPack = order.orderType === "pack";

      // The entitlement step. For b2c it returns an enrollmentId; for a pack it
      // returns a seatPackId. Captured for the common email + the outcome shape.
      let enrollmentId: Id<"lmsEnrollments"> | null = null;
      let seatPackId: Id<"lmsSeatPacks"> | null = null;

      if (isPack) {
        const mint = await ctx.runMutation(
          internal.lms.packs.mintSeatPackForOrder,
          { orderId: order._id }
        );
        seatPackId = mint.seatPackId;
        logMoney("info", "seat_pack_minted", "Seat pack minted for paid pack order", {
          orderId: order._id,
          mpPaymentId: fetched.id,
          organizationId: order.organizationId,
          courseId: order.courseId,
          seatPackId: mint.seatPackId,
          seatCount: order.seatCount,
        });
      } else {
        const enrollment = await ctx.runMutation(
          internal.lms.enrollments.grantEnrollmentForOrder,
          { orderId: order._id }
        );
        enrollmentId = enrollment.enrollmentId;
        logMoney("info", "enrollment_granted", "Enrollment granted for paid order", {
          orderId: order._id,
          mpPaymentId: fetched.id,
          learnerId: order.customerId,
          courseId: order.courseId,
          enrollmentId: enrollment.enrollmentId,
        });
      }

      // --- COMMON: revenue share (same 80/20 split for b2c AND pack) --------
      await ctx.runMutation(internal.lms.payment.ledger.recordRevenueShare, {
        paymentId,
        grossUsd: order.priceUsd,
        grossArs: fetched.amount,
        feeDetails: fetched.feeDetails,
      });

      // --- COMMON: buyer confirmation email — SCHEDULED, never awaited. -----
      // A mutation cannot await an action; it schedules one. Scheduling also
      // isolates the send from this transaction: a mail failure must not roll
      // back the committed entitlement/payment/ledger. This branch is reached
      // EXACTLY once per payment (the by_mp_payment_id dedupe above
      // short-circuits a replayed webhook to `already_processed` before here),
      // so a dup webhook never schedules a second email. For a B2C order the
      // email carries the enrollmentId + courseSlug (direct player link); for a
      // pack the buyer is the org owner who manages seats from the console, so
      // we omit both and the email links to the site root. Best-effort: if the
      // course row is gone we skip the email rather than fail the money path.
      const course = await ctx.db.get(order.courseId);
      if (course && !course.deletedAt) {
        await ctx.scheduler.runAfter(
          0,
          internal.lms.payment.email.sendBuyerConfirmationEmail,
          {
            learnerId: order.customerId,
            enrollmentId: enrollmentId ?? undefined,
            courseTitle: course.title,
            courseSlug: isPack ? undefined : course.slug,
          }
        );
      } else {
        logMoney("error", "confirmation_email_skipped", "Course row missing; skipping buyer email (money path unaffected)", {
          orderId: order._id,
          mpPaymentId: fetched.id,
          courseId: order.courseId,
        });
      }

      if (isPack) {
        // seatPackId is always set here (mint either created or found the pack).
        return {
          outcome: "approved_pack" as const,
          paymentId,
          orderId: order._id,
          seatPackId: seatPackId as Id<"lmsSeatPacks">,
        };
      }
      return {
        outcome: "approved" as const,
        paymentId,
        orderId: order._id,
        enrollmentId: enrollmentId as Id<"lmsEnrollments">,
      };
    }

    // --- (6) REJECTED / CANCELLED -------------------------------------------
    if (fetched.status === "rejected" || fetched.status === "cancelled") {
      const paymentId = await ctx.db.insert("lmsPayments", {
        orderId: order._id,
        mpPaymentId: fetched.id,
        status: fetched.status,
        grossArs: fetched.amount,
        usdAmount: order.priceUsd,
        webhookEventLog: [
          ...args.priorEvents,
          { eventType: fetched.status, payload: fetched, timestamp: now },
        ],
        lastVerifiedAt: now,
        createdAt: now,
      });

      // rejected → order failed; cancelled → order cancelled. No entitlement,
      // no ledger row.
      await ctx.db.patch(order._id, {
        status: fetched.status === "rejected" ? "failed" : "cancelled",
        updatedAt: now,
      });

      return {
        outcome: fetched.status as "rejected" | "cancelled",
        paymentId,
        orderId: order._id,
      };
    }

    // --- pending / unresolved ------------------------------------------------
    // Record the payment row as pending (audit) but take no entitlement action;
    // MP will send a follow-up webhook when the payment resolves. We still
    // dedupe on mpPaymentId, so the resolving webhook will find this row and
    // short-circuit — meaning a pending row must NOT block the later approval.
    // To avoid that deadlock we do NOT insert a row for pending; we simply log
    // nothing durable and return, so the next (approved/rejected) webhook is
    // the first to insert. This keeps the by_mp_payment_id dedupe clean.
    return {
      outcome: "pending" as const,
      orderId: order._id,
    };
  },
});
