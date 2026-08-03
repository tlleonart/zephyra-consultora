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
 *   shape (Ferozo SMTP, from "Academia Zephyra", dev console-fallback when
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
 * files, never logged). ZEPHYRA_ACADEMIA_URL drives the player link and has NO
 * fallback — see convex/model/publicUrls.ts for why the apex default was removed
 * at M4 (domain-boundaries v1.1 §5).
 */

"use node";

import { internalAction } from "../../_generated/server";
import { api } from "../../_generated/api";
import { v } from "convex/values";
import { createTransport } from "nodemailer";
import { Resend } from "resend";
import { logMoney } from "./logging";
import { academiaBaseUrl } from "../../model/publicUrls";

// Buyer-facing links point at apps/academia and nowhere else (boundaries §5):
// /cursos/<slug>/player is served by that app only. academiaBaseUrl() THROWS on
// a missing ZEPHYRA_ACADEMIA_URL rather than falling back to the apex.
//
// Tolerating the throw here is deliberate and safe: this action is SCHEDULED
// from the approved branch of processVerifiedPayment, i.e. after the
// enrollment/payment/ledger transaction has already committed. A throw fails
// the scheduled action — loudly, in the Convex function logs, naming the
// variable — and costs the buyer their confirmation email; it CANNOT roll back
// the enrollment (DoD: "email failure doesn't block enrollment" still holds).
// The alternative, an apex link, is a 404 for the learner with no signal at all.
const publicBaseUrl = academiaBaseUrl;

/**
 * EMAIL BRAND CHROME — a DELIBERATE, TEST-PINNED MIRROR, not a copy by accident.
 *
 * apps/academia/src/lib/brand.ts is the single edit point for the brand, and
 * this file cannot import it: Convex bundles only the `convex/` tree and the
 * `@/` (src) alias does not exist here — the same constraint documented at the
 * top of this file for the mailer. So the palette and the lockup path are
 * re-declared, and a test in apps/academia asserts these values are IDENTICAL to
 * brand.ts's. If someone swaps the lockup (D-1) and misses this file, the suite
 * goes red instead of the email quietly shipping the old mark.
 *
 * The band is a table-cell background colour, not a background image: Outlook
 * drops CSS background-image and most clients block remote images on first open,
 * so an image-only band renders WHITE for a large share of recipients. Colour +
 * alt text degrades correctly in both states.
 */
const EMAIL_GREEN = "#1E3C2E";
const EMAIL_PAPER = "#EFEAE0";
const EMAIL_CARD = "#FCFAF6";
const EMAIL_SAND = "#E5DFD5";
const EMAIL_TEXT = "#1A1A1A";
const EMAIL_TEXT_SECONDARY = "#4A453B";
const EMAIL_BORDER = "#D8CFBF";
const EMAIL_LOCKUP_PATH = "/images/brand/lockup-academia-sand-on-transparent.png";

// Inline HTML template — plain string, no React render (keeps the Node bundle
// light; the visual shape mirrors src/emails/LearnerMagicLink.tsx: green band
// lockup header, card body on paper, single green CTA, warm muted footer).
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
  // The lockup host is derived from the playerUrl the caller already composed
  // (which comes from ZEPHYRA_ACADEMIA_URL), so no literal host is written here.
  // An unparseable URL degrades to a relative src: the image fails to load and
  // the alt text carries the brand on the green band — never a broken host.
  let origin = "";
  try {
    origin = new URL(props.playerUrl).origin;
  } catch {
    origin = "";
  }
  const lockupSrc = `${origin}${EMAIL_LOCKUP_PATH}`;
  return `<!DOCTYPE html>
<html lang="es">
  <body style="background-color:${EMAIL_PAPER};font-family:Helvetica, Arial, sans-serif;margin:0;padding:24px 0;">
    <div style="max-width:560px;margin:0 auto;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
        <tr>
          <td bgcolor="${EMAIL_GREEN}" style="background-color:${EMAIL_GREEN};padding:28px 32px;border-radius:12px 12px 0 0;">
            <img src="${esc(lockupSrc)}" alt="Academia Zephyra" height="34" style="display:block;border:0;height:34px;width:auto;color:${EMAIL_SAND};font-family:Georgia, 'Times New Roman', serif;font-size:19px;font-weight:600;" />
          </td>
        </tr>
      </table>
      <div style="background-color:${EMAIL_CARD};border:1px solid ${EMAIL_BORDER};border-top:none;border-radius:0 0 12px 12px;padding:32px;">
        <h1 style="color:${EMAIL_GREEN};font-family:Georgia, 'Times New Roman', serif;font-size:24px;line-height:1.25;font-weight:600;margin:0 0 16px;">¡Compra confirmada!</h1>
        <p style="color:${EMAIL_TEXT};font-size:16px;line-height:24px;margin:0 0 12px;">Hola ${esc(props.greetingName)},</p>
        <p style="color:${EMAIL_TEXT};font-size:16px;line-height:24px;margin:0 0 12px;">Tu compra del curso <strong>${esc(props.courseTitle)}</strong> ha sido confirmada.</p>
        <p style="color:${EMAIL_TEXT};font-size:16px;line-height:24px;margin:0 0 12px;">Ya podés acceder a tu curso:</p>
        <div style="margin:24px 0;">
          <a href="${esc(props.playerUrl)}" style="background-color:${EMAIL_GREEN};color:#FFFFFF;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:600;display:inline-block;">Ir al curso</a>
        </div>
        <hr style="border:none;border-top:1px solid ${EMAIL_BORDER};margin:24px 0;" />
        <p style="color:${EMAIL_TEXT_SECONDARY};font-size:12px;line-height:18px;margin:0 0 6px;">Si no realizaste esta compra, contactá a soporte.</p>
        <p style="color:${EMAIL_TEXT_SECONDARY};font-size:12px;line-height:18px;margin:0 0 6px;">Una iniciativa de Zephyra</p>
      </div>
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
    // Optional: present for a B2C purchase (drives the direct player link);
    // ABSENT for a pack purchase (the buyer is the org Owner Admin, who claims
    // seats to learners rather than receiving a direct enrollment).
    enrollmentId: v.optional(v.id("lmsEnrollments")),
    courseTitle: v.string(),
    // Optional: drives the /cursos/<slug>/player link on a B2C purchase. For a
    // pack purchase the buyer manages seats from the org console, so we link to
    // the public site root instead of a player they don't directly enrol into.
    courseSlug: v.optional(v.string()),
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
    // in the URL. For a pack purchase (no enrollment / no slug) we link to the
    // public site root — the org owner manages seats from the console, not a
    // direct player they enrolled into.
    const playerUrl = args.courseSlug
      ? `${publicBaseUrl()}/cursos/${args.courseSlug}/player`
      : `${publicBaseUrl()}/`;

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
    if (!process.env.RESEND_API_KEY && !process.env.EMAIL_USER) {
      // Dev-only fallback (no provider creds). The email address appears here
      // ONLY in dev; this branch never runs in prod, so the PII-hygiene rule (no
      // buyer email in logs) is preserved for production.
      console.warn(
        "[lms-buyer-email-dev] no RESEND_API_KEY / EMAIL_USER set; rendering to log only"
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
      // Primary: Resend (handles deliverability; not blocked as spam like the
      // shared-host SMTP). Fallback: legacy Ferozo SMTP when RESEND_API_KEY is
      // absent. Both read creds from the Convex env only.
      if (process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { error } = await resend.emails.send({
          from: process.env.EMAIL_FROM ?? "Zephyra <no-reply@zephyraconsultora.com>",
          to: learner.email,
          subject,
          html,
          text,
        });
        if (error) {
          throw new Error(
            `Resend send failed: ${error.message ?? JSON.stringify(error)}`
          );
        }
      } else {
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
          // Display name is the PRODUCT, not the consultancy: this mail is about a
      // course. The ADDRESS is unchanged (guide §8.4 fixes the sender address);
      // only the friendly name moves. Naming is test-enforced: "Academia
      // Zephyra", never "Zephyra Academy", never "LMS".
      from: `"Academia Zephyra" <${process.env.EMAIL_USER}>`,
          to: learner.email,
          subject,
          html,
          text,
        });
      }
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
