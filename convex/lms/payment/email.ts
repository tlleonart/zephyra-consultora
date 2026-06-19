/**
 * LMS — Buyer confirmation email (Sprint 2 Phase P1.6).
 *
 * Sends the learner a "compra confirmada" email after the webhook approves a
 * payment and the enrollment is granted.
 *
 * WHY a "use node" internalAction (NOT an internalMutation, as the handoff
 * sketched):
 *   Sending email is a SIDE EFFECT — outbound SMTP + reading EMAIL_* env. A
 *   Convex mutation is transactional and can do NEITHER (no network, no Node
 *   runtime). This repo's invariant is "email is never sent from a mutation":
 *   the magic-link flow (convex/lms/auth.ts) mints the token in a mutation and
 *   the Next.js server action sends. The webhook breaks that pattern because it
 *   is INBOUND to Convex (httpAction) with no Next.js layer in the loop, so the
 *   send has to happen Convex-side — which means an action, and because
 *   nodemailer is a Node library, a "use node" action.
 *
 * WHY it cannot reuse src/lib/mailer/learner.ts:
 *   Convex bundles only the `convex/` tree; the `@/` (src) path alias is NOT
 *   available to Convex functions (verified: no convex file imports from src).
 *   So the transport + template are re-implemented minimally here. The send
 *   shape (Ferozo SMTP, from "Zephyra Consultora", dev console-fallback when
 *   EMAIL_USER is absent) MIRRORS src/lib/mailer/learner.ts intentionally so
 *   the two mailers stay behaviourally identical.
 *
 * WHY it is SCHEDULED (ctx.scheduler.runAfter), not awaited inline:
 *   The approved branch lives inside processVerifiedPayment (a mutation). A
 *   mutation cannot await an action; it can only schedule one. Scheduling also
 *   gives us the right failure isolation — a mail bounce must NOT roll back the
 *   committed enrollment/payment/ledger transaction (DoD: "email failure
 *   doesn't block enrollment"). The action swallows send errors (logs, no
 *   throw) for the same reason.
 *
 * IDEMPOTENCY (no duplicate email on replayed webhook):
 *   The send is scheduled ONLY from the approved branch of
 *   processVerifiedPayment, which is reached exactly once per payment: the
 *   lmsPayments.by_mp_payment_id dedupe short-circuits a replayed webhook to
 *   the `already_processed` outcome BEFORE the approved branch runs. So a dup
 *   webhook never schedules a second email.
 *
 * Secrets: EMAIL_USER / EMAIL_PASSWORD read from the Convex env only (never
 * files, never logged). NEXT_PUBLIC_SITE_URL / ZEPHYRA_PUBLIC_URL drive the
 * public player link; falls back to the production host.
 */

"use node";

import { internalAction } from "../../_generated/server";
import { api } from "../../_generated/api";
import { v } from "convex/values";
import { createTransport } from "nodemailer";
import { logMoney } from "./logging";

// Public base URL for the buyer-facing player link. Mirrors the convention
// used across the app (NEXT_PUBLIC_SITE_URL in the Next.js pages,
// ZEPHYRA_PUBLIC_URL in convex/lms/payment/mercadopago.ts); accept either and
// fall back to the production host so a missing env never yields a broken link.
const publicBaseUrl = (): string =>
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.ZEPHYRA_PUBLIC_URL ??
  "https://zephyraconsultora.com";

// Inline HTML template — plain string, no React render (keeps the Node bundle
// light; the visual shape mirrors src/emails/LearnerMagicLink.tsx: black brand
// header, single CTA button, muted footer).
const confirmationEmailHtml = (props: {
  greetingName: string;
  courseTitle: string;
  playerUrl: string;
}): string => {
  const esc = (s: string): string =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  return `<!DOCTYPE html>
<html lang="es">
  <body style="background-color:#ffffff;font-family:Arial, sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:24px;">
      <h2 style="color:#000000;font-size:20px;margin:0 0 16px;">Zephyra</h2>
      <h1 style="color:#000000;font-size:24px;margin:0 0 16px;">¡Compra confirmada!</h1>
      <p style="color:#000000;font-size:16px;line-height:24px;">Hola ${esc(props.greetingName)},</p>
      <p style="color:#000000;font-size:16px;line-height:24px;">Tu compra del curso <strong>${esc(props.courseTitle)}</strong> ha sido confirmada.</p>
      <p style="color:#000000;font-size:16px;line-height:24px;">Ya podés acceder a tu curso:</p>
      <div style="margin:24px 0;">
        <a href="${esc(props.playerUrl)}" style="background-color:#000000;color:#ffffff;padding:12px 24px;border-radius:4px;text-decoration:none;font-size:16px;display:inline-block;">Ir al curso</a>
      </div>
      <hr style="border-color:#dddddd;margin:24px 0;" />
      <p style="color:#555555;font-size:12px;line-height:18px;">Si no realizaste esta compra, contactá a soporte.</p>
    </div>
  </body>
</html>`;
};

// Plain-text alternative (deliverability — some clients prefer text/plain).
const confirmationEmailText = (props: {
  greetingName: string;
  courseTitle: string;
  playerUrl: string;
}): string =>
  `Hola ${props.greetingName},\n\n` +
  `Tu compra del curso "${props.courseTitle}" ha sido confirmada.\n\n` +
  `Accedé a tu curso: ${props.playerUrl}\n\n` +
  `Si no realizaste esta compra, contactá a soporte.`;

/**
 * sendBuyerConfirmationEmail — internalAction ONLY. There is no client-facing
 * path to trigger this; it is scheduled exclusively from the approved branch of
 * processVerifiedPayment (convex/lms/payment/internal.ts).
 *
 * Takes only IDs + the resolved courseSlug/courseTitle the mutation already has
 * in scope; the learner email is resolved here (the action has no ctx.db) by
 * reusing the existing api.lms.auth.getLearnerById query — which already strips
 * passwordHash and returns null on missing/soft-deleted. A "use node" file may
 * only export actions, so the lookup lives in convex/lms/auth.ts (V8), not
 * here. Errors are logged and swallowed: a send failure must not surface as a
 * scheduler retry storm and must not affect the already-committed enrollment.
 */
export const sendBuyerConfirmationEmail = internalAction({
  args: {
    learnerId: v.id("lmsCustomers"),
    enrollmentId: v.id("lmsEnrollments"),
    courseTitle: v.string(),
    courseSlug: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    // Resolve the learner email (action has no ctx.db). getLearnerById strips
    // passwordHash and returns null on missing/soft-deleted.
    const learner = await ctx.runQuery(api.lms.auth.getLearnerById, {
      learnerId: args.learnerId,
    });
    if (!learner) {
      logMoney("error", "confirmation_email_skipped", "Learner not found; cannot send confirmation email", {
        learnerId: args.learnerId,
        enrollmentId: args.enrollmentId,
      });
      return;
    }

    // Player link keys on the course SLUG (the real route is
    // /cursos/<slug>/player — NOT courseId). The player page gates access via
    // the learner's session cookie + active enrollment, so no token is needed
    // in the URL.
    const playerUrl = `${publicBaseUrl()}/cursos/${args.courseSlug}/player`;

    // lmsCustomers has no displayName field — greet by email (same shape as
    // LearnerMagicLink's optional recipientName).
    const props = {
      greetingName: learner.email,
      courseTitle: args.courseTitle,
      playerUrl,
    };
    const html = confirmationEmailHtml(props);
    const text = confirmationEmailText(props);
    const subject = `Compra confirmada: ${args.courseTitle}`;

    // Dev fallback (mirrors src/lib/mailer/learner.ts): when SMTP creds are
    // absent, render to the log instead of throwing, so dev does not require
    // Ferozo credentials.
    if (!process.env.EMAIL_USER) {
      // Dev-only fallback (no SMTP creds). The email address appears here ONLY
      // in dev; this branch never runs in prod, so the PII-hygiene rule (no
      // buyer email in logs) is preserved for production.
      console.warn(
        "[lms-buyer-email-dev] EMAIL_USER not set; rendering to log only"
      );
      console.warn(
        `[lms-buyer-email-dev] to=${learner.email} subject=${subject} playerUrl=${playerUrl}`
      );
      logMoney("warn", "confirmation_email_skipped", "Dev fallback — EMAIL_USER unset, email rendered to log only", {
        learnerId: args.learnerId,
        enrollmentId: args.enrollmentId,
      });
      return;
    }

    try {
      const transporter = createTransport({
        host: "c2810738.ferozo.com",
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });
      await transporter.sendMail({
        from: `"Zephyra Consultora" <${process.env.EMAIL_USER}>`,
        to: learner.email,
        subject,
        html,
        text,
      });
      // PII hygiene: log the learnerId, never the buyer's email address.
      logMoney("info", "confirmation_email_sent", "Buyer confirmation email dispatched", {
        learnerId: args.learnerId,
        enrollmentId: args.enrollmentId,
      });
    } catch (err) {
      // Log but do NOT throw: the enrollment/payment/ledger transaction is
      // already committed; an email failure must not trigger scheduler retries
      // or otherwise affect entitlement.
      logMoney("error", "confirmation_email_skipped", "Confirmation email send failed (enrollment unaffected)", {
        learnerId: args.learnerId,
        enrollmentId: args.enrollmentId,
        reason: String(err),
      });
    }
  },
});
