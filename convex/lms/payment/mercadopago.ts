/**
 * LMS — MercadoPagoAdapter (Sprint 2 Phase P0 — money-path core).
 *
 * V1 implementation of the PaymentProvider contract. Phase P0 implements the
 * two methods the inbound webhook path needs:
 *   - verifyWebhook     -> x-signature HMAC verification (MP_WEBHOOK_SECRET)
 *   - fetchPaymentState -> GET /v1/payments/{id} (authoritative state)
 * `createCheckoutSession` lands in Phase P1 (checkout flow); `refund` is V1.x.
 *
 * Transport: raw `fetch` (no MP SDK) — approved at decomposition (Q2). This
 * adapter is instantiated inside a Convex `action` / `httpAction` (the only
 * runtimes allowed outbound HTTP + env access); NEVER inside a query/mutation.
 *
 * Crypto: Convex runs in a V8 isolate with NO Node `crypto` module. HMAC uses
 * Web Crypto (`crypto.subtle`) — the same primitive convex/model/passwords.ts
 * uses for opaque-token HMAC. The signature-verification math is extracted to a
 * pure, dependency-free helper (`verifyMercadoPagoSignature`) so it is unit
 * testable without the adapter / env / network.
 *
 * Credentials are read from the Convex env exclusively — NEVER from .env files
 * and NEVER hardcoded. No secret values appear in this source.
 */

import type {
  CheckoutOrderInput,
  CheckoutSession,
  PaymentProvider,
  PaymentState,
  RefundResult,
  WebhookVerification,
} from "./types";

const MP_API_BASE = "https://api.mercadopago.com";

// =============================================================================
// Pure crypto helpers (no env, no network — unit testable)
// =============================================================================

/** Lowercase-hex encode a byte array. */
const toHex = (bytes: Uint8Array): string => {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
};

/** Constant-time string compare (defeats timing oracles on the HMAC compare). */
const constantTimeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
};

/** Import a UTF-8 secret as an HMAC-SHA-256 signing key (Web Crypto). */
const importHmacKey = (secret: string): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

/**
 * Parse the MercadoPago `x-signature` header.
 * Format: "ts=<unix-ts>,v1=<hex-hmac>" (order/whitespace tolerant).
 * Returns null if either field is absent.
 */
export function parseMercadoPagoSignatureHeader(
  header: string
): { ts: string; v1: string } | null {
  let ts: string | undefined;
  let v1: string | undefined;
  for (const part of header.split(",")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === "ts") ts = value;
    else if (key === "v1") v1 = value;
  }
  if (!ts || !v1) return null;
  return { ts, v1 };
}

/**
 * Verify a MercadoPago webhook signature.
 *
 * MP's documented manifest for the v1 HMAC is:
 *   `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * The HMAC-SHA-256 of that manifest, keyed with MP_WEBHOOK_SECRET, must equal
 * the `v1` value carried in the `x-signature` header.
 *
 * `dataId` is the resource id from the notification (the `data.id` query param
 * MP appends to the webhook URL, echoed in the body). Comparison is
 * constant-time. Pure: no env, no I/O — unit testable in isolation.
 */
export async function verifyMercadoPagoSignature(args: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
  secret: string;
}): Promise<boolean> {
  const { signatureHeader, requestId, dataId, secret } = args;
  if (!signatureHeader || !secret) return false;

  const parsed = parseMercadoPagoSignatureHeader(signatureHeader);
  if (!parsed) return false;

  // MP manifest. Fields that are absent are omitted from the template per MP's
  // spec; in practice `data.id` and `ts` are always present, `request-id` is
  // present when the x-request-id header is delivered.
  let manifest = "";
  if (dataId) manifest += `id:${dataId};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${parsed.ts};`;

  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(manifest)
  );
  const computed = toHex(new Uint8Array(sig));

  return constantTimeEqual(computed, parsed.v1.toLowerCase());
}

/**
 * Map a raw MP payment `status` string onto the PaymentState union.
 * MP statuses: approved | pending | in_process | authorized | in_mediation |
 * rejected | cancelled | refunded | charged_back. We collapse the
 * not-yet-resolved family onto "pending" and the negative family onto
 * "rejected"/"cancelled" (the only two the money-path acts on negatively).
 */
export function normalizeMercadoPagoStatus(
  raw: string
): PaymentState["status"] {
  switch (raw) {
    case "approved":
      return "approved";
    case "cancelled":
      return "cancelled";
    case "rejected":
    case "charged_back":
      return "rejected";
    default:
      // pending | in_process | authorized | in_mediation | refunded | unknown
      return "pending";
  }
}

// =============================================================================
// Adapter
// =============================================================================

export class MercadoPagoAdapter implements PaymentProvider {
  private readonly accessToken: string;
  private readonly webhookSecret: string;
  private readonly publicKey: string;
  private readonly baseUrl = MP_API_BASE;
  /** Public-facing site origin (no trailing slash) — drives back_urls. */
  private readonly siteUrl: string;
  /** Convex deployment HTTP origin — drives notification_url (the webhook lives in convex/http.ts). */
  private readonly webhookUrl: string;

  constructor() {
    // Read from Convex env — never from .env files, never hardcoded.
    const accessToken = process.env.MP_ACCESS_TOKEN;
    const webhookSecret = process.env.MP_WEBHOOK_SECRET;
    const publicKey = process.env.MP_PUBLIC_KEY;

    if (!accessToken || !webhookSecret || !publicKey) {
      throw new Error(
        "Missing MP credentials in Convex env: MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, MP_PUBLIC_KEY"
      );
    }

    this.accessToken = accessToken;
    this.webhookSecret = webhookSecret;
    this.publicKey = publicKey;

    // back_urls land the buyer on the public Next.js app. ZEPHYRA_PUBLIC_URL is
    // the site origin; falls back to the prod domain so a missing-env dev never
    // mints an http://localhost back_url MP would reject (MP requires https for
    // auto_return). Trailing slash trimmed for clean concatenation.
    this.siteUrl = (
      process.env.ZEPHYRA_PUBLIC_URL ?? "https://zephyraconsultora.com"
    ).replace(/\/+$/, "");

    // notification_url MUST point at the Convex deployment's HTTP endpoint
    // (convex/http.ts mounts /api/lms/mp/webhook), NOT the Next.js app — Next.js
    // never sees the webhook. CONVEX_SITE_URL is the .convex.site HTTP origin
    // Convex injects; we fall back to deriving it from the cloud URL if unset.
    const explicitSite = process.env.CONVEX_SITE_URL;
    const cloudUrl = process.env.CONVEX_CLOUD_URL;
    const derived = cloudUrl
      ? cloudUrl.replace(".convex.cloud", ".convex.site")
      : null;
    this.webhookUrl = (explicitSite ?? derived ?? this.siteUrl).replace(
      /\/+$/,
      ""
    );
  }

  /**
   * Open a MercadoPago Checkout Pro preference for the order.
   *
   * POST /checkout/preferences. The buyer is priced in USD (SDD §9.4 — MP
   * converts to ARS on its side). `external_reference` carries OUR orderId so
   * the inbound webhook (verify-before-trust) can map the MP payment back to
   * the order. `auto_return: "approved"` redirects on success without a manual
   * click. `notification_url` targets the Convex webhook, distinct from the
   * back_urls (which land on the public Next.js app).
   *
   * Runs only inside a Convex action (the adapter reads env + does outbound
   * HTTP — never in a query/mutation). Returns the preference id + init_point.
   */
  async createCheckoutSession(
    order: CheckoutOrderInput
  ): Promise<CheckoutSession> {
    const returnBase = `${this.siteUrl}/cursos/${order.courseSlug}/compra`;
    const ref = encodeURIComponent(order.orderId);

    const res = await fetch(`${this.baseUrl}/checkout/preferences`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            id: order.courseId,
            title: order.courseTitle,
            quantity: 1,
            currency_id: order.currency, // "USD"
            unit_price: order.priceUsd,
          },
        ],
        payer: { email: order.payerEmail },
        external_reference: order.orderId,
        back_urls: {
          success: `${returnBase}/exito?orderId=${ref}`,
          failure: `${returnBase}/error?orderId=${ref}`,
          pending: `${returnBase}/pendiente?orderId=${ref}`,
        },
        notification_url: `${this.webhookUrl}/api/lms/mp/webhook`,
        auto_return: "approved",
      }),
    });

    if (!res.ok) {
      throw new Error(
        `MercadoPago createCheckoutSession failed: ${res.status} ${res.statusText}`
      );
    }

    const preference = (await res.json()) as {
      id?: string | number;
      init_point?: string;
      sandbox_init_point?: string;
    };

    const redirectUrl = preference.init_point ?? preference.sandbox_init_point;
    if (preference.id === undefined || preference.id === null || !redirectUrl) {
      throw new Error(
        "MercadoPago createCheckoutSession: preference response missing id/init_point"
      );
    }

    return {
      externalId: String(preference.id),
      redirectUrl,
    };
  }

  /**
   * Verify an inbound webhook's authenticity (x-signature HMAC) and classify
   * its intent. The payload is treated as an UNTRUSTED "go look" signal — the
   * authoritative state is fetched separately via fetchPaymentState. We extract
   * the referenced payment id from the headers/body bridge the caller passes.
   */
  async verifyWebhook(
    payload: unknown,
    headers: Record<string, string>
  ): Promise<WebhookVerification> {
    const signatureHeader =
      headers["x-signature"] ?? headers["X-Signature"] ?? null;
    const requestId =
      headers["x-request-id"] ?? headers["X-Request-Id"] ?? null;

    // The resource id is the `data.id` of the notification body. We do NOT
    // trust any state field from the body — only the id, and only as the
    // pointer to GET /v1/payments/{id}.
    const body = (payload ?? {}) as {
      type?: string;
      action?: string;
      data?: { id?: string | number };
    };
    const dataId =
      body.data?.id !== undefined && body.data?.id !== null
        ? String(body.data.id)
        : null;

    const valid = await verifyMercadoPagoSignature({
      signatureHeader,
      requestId,
      dataId,
      secret: this.webhookSecret,
    });

    if (!valid) {
      return { valid: false, reason: "signature_mismatch" };
    }
    if (!dataId) {
      return { valid: false, reason: "missing_payment_id" };
    }

    // Only payment notifications are actionable in V1. MP sends `type:"payment"`
    // (Webhooks) and historically `topic:"payment"` (IPN) — we accept either.
    const isPayment =
      body.type === "payment" ||
      (body as { topic?: string }).topic === "payment";
    if (!isPayment) {
      return { valid: false, reason: "unsupported_topic" };
    }

    return {
      valid: true,
      paymentId: dataId,
      action:
        body.action === "payment.created"
          ? "payment.created"
          : "payment.updated",
    };
  }

  /**
   * Authoritatively fetch a payment's current state from the MP API.
   * GET /v1/payments/{id} with the secret access token. This is the
   * verify-before-trust step — the webhook body is never trusted for state,
   * amount, currency, or external_reference.
   */
  async fetchPaymentState(externalId: string): Promise<PaymentState> {
    const res = await fetch(`${this.baseUrl}/v1/payments/${externalId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(
        `MercadoPago fetchPaymentState failed: ${res.status} ${res.statusText}`
      );
    }

    const raw = (await res.json()) as {
      id?: string | number;
      status?: string;
      transaction_amount?: number;
      currency_id?: string;
      external_reference?: string;
      fee_details?: Array<{ type?: string; amount?: number }>;
    };

    return {
      id: String(raw.id ?? externalId),
      status: normalizeMercadoPagoStatus(raw.status ?? "pending"),
      amount: typeof raw.transaction_amount === "number"
        ? raw.transaction_amount
        : 0,
      currency: raw.currency_id ?? "",
      external_reference: raw.external_reference ?? "",
      fee_details: Array.isArray(raw.fee_details)
        ? raw.fee_details.map((f) => ({
            type: f.type ?? "unknown",
            amount: typeof f.amount === "number" ? f.amount : 0,
          }))
        : undefined,
    };
  }

  async refund(paymentId: string, amount?: number): Promise<RefundResult> {
    // Refund execution deferred to V1.x.
    void paymentId;
    void amount;
    throw new Error("Refund execution deferred to V1.x");
  }
}
