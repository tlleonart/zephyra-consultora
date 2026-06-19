/**
 * LMS — MercadoPagoAdapter skeleton (Sprint 2 P0.3).
 *
 * V1 implementation of the PaymentProvider contract. SKELETON ONLY: the
 * constructor reads + validates credentials from the Convex env; every method
 * body is a stub. Phase P0 (money-path core) implements:
 *   - createCheckoutSession -> POST /checkout/preferences (Checkout Pro)
 *   - verifyWebhook         -> x-signature HMAC verification (MP_WEBHOOK_SECRET)
 *   - fetchPaymentState     -> GET /v1/payments/{id}
 * `refund` is deferred to V1.x.
 *
 * Transport: raw `fetch` (no MP SDK) — approved at decomposition (Q2). This
 * adapter is instantiated inside a Convex `action` (the only runtime allowed
 * outbound HTTP + env access); never inside a query/mutation.
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

export class MercadoPagoAdapter implements PaymentProvider {
  private readonly accessToken: string;
  private readonly webhookSecret: string;
  private readonly publicKey: string;
  private readonly baseUrl = "https://api.mercadopago.com";

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
  }

  async createCheckoutSession(
    order: CheckoutOrderInput
  ): Promise<CheckoutSession> {
    // Stub — Phase P0 (money-path core) implements POST /checkout/preferences.
    void order;
    throw new Error(
      "MercadoPagoAdapter.createCheckoutSession not implemented in Phase P0 — lands in Phase P0 money-path core"
    );
  }

  async verifyWebhook(
    payload: unknown,
    headers: Record<string, string>
  ): Promise<WebhookVerification> {
    // Stub — Phase P0 implements x-signature HMAC verify against MP_WEBHOOK_SECRET.
    void payload;
    void headers;
    throw new Error(
      "MercadoPagoAdapter.verifyWebhook not implemented in Phase P0 — lands in Phase P0 money-path core"
    );
  }

  async fetchPaymentState(externalId: string): Promise<PaymentState> {
    // Stub — Phase P0 implements GET /v1/payments/{id}.
    void externalId;
    throw new Error(
      "MercadoPagoAdapter.fetchPaymentState not implemented in Phase P0 — lands in Phase P0 money-path core"
    );
  }

  async refund(paymentId: string, amount?: number): Promise<RefundResult> {
    // Refund execution deferred to V1.x.
    void paymentId;
    void amount;
    throw new Error("Refund execution deferred to V1.x");
  }
}
