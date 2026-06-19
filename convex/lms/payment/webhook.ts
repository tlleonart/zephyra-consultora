/**
 * LMS — MercadoPago webhook handler (Sprint 2 Phase P0.4 — the load-bearing one).
 *
 * Route: POST /api/lms/mp/webhook (wired in convex/http.ts).
 *
 * This is a Convex httpAction. Its signature is (ctx, request) — there is NO
 * argument validator (that is a query/mutation concept). httpActions run in the
 * V8 isolate, can do outbound HTTP + read env, but are NOT transactional and
 * have NO ctx.db. So this handler does ONLY:
 *   (1) VERIFY x-signature HMAC (control #1) — invalid ⇒ 401, never fetch.
 *   (2) FETCH authoritative state from MP (control #2) — body is untrusted.
 *   (3-6) DELEGATE to processVerifiedPayment internalMutation — the single
 *         transaction that owns idempotency, anti-tamper, enrollment + ledger.
 *
 * Response policy: 401 on bad signature (so MP/attackers learn the endpoint is
 * authenticated and the delivery was rejected); 200 on every other outcome
 * (incl. "order not found", "amount mismatch", transient MP fetch failure) so
 * MercadoPago does NOT enter an aggressive retry loop on conditions a retry
 * cannot fix. Forensic detail lives in lmsPayments.webhookEventLog + logs.
 *
 * Secrets (MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, MP_PUBLIC_KEY) are read inside
 * MercadoPagoAdapter from the Convex env only — never from files, never logged.
 */

import { internal } from "../../_generated/api";
import { httpAction } from "../../_generated/server";
import { logMoney } from "./logging";
import { MercadoPagoAdapter } from "./mercadopago";

type LogEvent = { eventType: string; payload: unknown; timestamp: number };

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const handleMercadoPagoWebhook = httpAction(async (ctx, request) => {
  // Adapter construction validates that all MP credentials are present in env.
  let adapter: MercadoPagoAdapter;
  try {
    adapter = new MercadoPagoAdapter();
  } catch (err) {
    logMoney("error", "provider_not_configured", "MP webhook: adapter init failed (missing env?)", {
      reason: String(err),
    });
    return json({ error: "provider_not_configured" }, 500);
  }

  // Read raw body once; parse defensively. The body is an UNTRUSTED signal —
  // only used to extract the resource id (data.id) for the authoritative fetch.
  const rawBody = await request.text();
  let parsedBody: unknown = {};
  try {
    parsedBody = rawBody.length > 0 ? JSON.parse(rawBody) : {};
  } catch {
    // Non-JSON body — treat as empty; signature verify on empty data.id fails.
    parsedBody = {};
  }

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  const now = Date.now();
  const requestId = headers["x-request-id"] ?? undefined;
  const events: LogEvent[] = [
    { eventType: "webhook_received", payload: parsedBody, timestamp: now },
  ];
  logMoney("info", "webhook_received", "MP webhook received", { requestId });

  // --- (1) VERIFY x-signature HMAC ------------------------------------------
  const verification = await adapter.verifyWebhook(parsedBody, headers);
  if (!verification.valid) {
    logMoney("warn", "signature_rejected", "MP webhook rejected (signature/intent)", {
      reason: verification.reason,
      requestId,
    });
    // 401 for signature mismatch (authenticated endpoint); other invalid
    // classifications (missing id, unsupported topic) are 200 — a retry won't
    // fix them and they're not auth failures.
    const status =
      verification.reason === "signature_mismatch" ? 401 : 200;
    return json({ error: verification.reason }, status);
  }
  events.push({
    eventType: "signature_verified",
    payload: { ok: true },
    timestamp: Date.now(),
  });
  logMoney("info", "signature_verified", "MP webhook x-signature verified", {
    mpPaymentId: verification.paymentId,
    requestId,
  });

  // --- (2) FETCH authoritative state ----------------------------------------
  let fetched;
  try {
    fetched = await adapter.fetchPaymentState(verification.paymentId);
  } catch (err) {
    logMoney("error", "payment_state_fetch_failed", "MP fetchPaymentState failed (will retry on next delivery)", {
      mpPaymentId: verification.paymentId,
      requestId,
      reason: String(err),
    });
    // 200 so MP retries on its own schedule; transient API errors resolve on
    // the next delivery. No DB side effects on this path.
    return json({ status: "fetch_failed_will_retry" }, 200);
  }
  events.push({
    eventType: "state_fetched",
    payload: fetched,
    timestamp: Date.now(),
  });
  logMoney("info", "payment_state_fetched", "MP payment state fetched (authoritative)", {
    mpPaymentId: fetched.id,
    externalReference: fetched.external_reference,
    status: fetched.status,
    amountArs: fetched.amount,
    currency: fetched.currency,
    requestId,
  });

  // --- (3-6) DELEGATE to the transactional core -----------------------------
  const result = await ctx.runMutation(
    internal.lms.payment.internal.processVerifiedPayment,
    {
      fetched: {
        id: fetched.id,
        status: fetched.status,
        amount: fetched.amount,
        currency: fetched.currency,
        external_reference: fetched.external_reference,
        feeDetails: fetched.fee_details,
      },
      priorEvents: events,
    }
  );

  switch (result.outcome) {
    case "approved":
      logMoney("info", "payment_approved", "Payment approved and enrollment granted", {
        orderId: result.orderId,
        mpPaymentId: verification.paymentId,
        enrollmentId: result.enrollmentId,
        requestId,
      });
      break;
    case "already_processed":
      logMoney("info", "webhook_idempotent_noop", "Duplicate webhook — already processed, no side effects", {
        mpPaymentId: verification.paymentId,
        requestId,
      });
      break;
    case "order_not_found":
      logMoney("error", "order_not_found", "No order matches the fetched external_reference", {
        mpPaymentId: verification.paymentId,
        externalReference: result.externalReference,
        requestId,
      });
      break;
    case "amount_mismatch":
      logMoney("error", "amount_mismatch", "Anti-tamper REJECT: amount/currency mismatch", {
        mpPaymentId: verification.paymentId,
        reason: result.reason,
        requestId,
      });
      break;
    case "rejected":
      logMoney("info", "payment_rejected", "Payment rejected — order failed, no entitlement", {
        orderId: result.orderId,
        mpPaymentId: verification.paymentId,
        requestId,
      });
      break;
    case "cancelled":
      logMoney("info", "payment_cancelled", "Payment cancelled — order cancelled, no entitlement", {
        orderId: result.orderId,
        mpPaymentId: verification.paymentId,
        requestId,
      });
      break;
    case "pending":
      logMoney("info", "payment_pending", "Payment pending — no durable write, awaiting follow-up webhook", {
        orderId: result.orderId,
        mpPaymentId: verification.paymentId,
        requestId,
      });
      break;
  }

  // Always 200 once the signature was valid — MP must not retry-storm on
  // conditions a retry cannot change. Outcome is informational only.
  return json({ status: "ok", outcome: result.outcome }, 200);
});
