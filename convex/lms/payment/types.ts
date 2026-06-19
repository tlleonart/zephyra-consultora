/**
 * LMS — PaymentProvider abstraction (Sprint 2 P0.2).
 *
 * Single interface for every PSP. MercadoPago is the V1 implementation
 * (`mercadopago.ts`); Stripe / dLocal will implement the SAME interface
 * without changing it (SDD §3.4 — provider abstraction from day 1).
 *
 * Currency policy (SDD §9.4): orders are ALWAYS priced in USD. MercadoPago
 * converts to ARS on its side; `fetchPaymentState` therefore returns the
 * payment's NATIVE currency (ARS for MP), distinct from the order's USD.
 *
 * Pure TypeScript contract — no Convex runtime imports, no implementation.
 * Lives under `convex/lms/payment/` so it can be imported by the action /
 * HTTP-action layer that Phase P0 (money-path core) adds.
 */

/** Order payload handed to a provider to open a hosted checkout session. */
export interface CheckoutOrderInput {
  orderId: string;
  customerId: string;
  courseId: string;
  priceUsd: number;
  /** SDD §9.4: always USD in V1. */
  currency: "USD";
}

/** Result of opening a checkout session — the redirect target for the buyer. */
export interface CheckoutSession {
  /** Provider-side identifier (MP preference ID). */
  externalId: string;
  /** Hosted-checkout entry URL (MP Checkout Pro `init_point`). */
  redirectUrl: string;
}

/** Outcome of verifying an inbound webhook signature + parsing its intent. */
export type WebhookVerification =
  | {
      valid: true;
      /** Provider payment id referenced by the event. */
      paymentId: string;
      action: "payment.created" | "payment.updated";
    }
  | { valid: false; reason: string };

/** Canonical payment state fetched authoritatively from the provider API. */
export interface PaymentState {
  /** Provider payment id. */
  id: string;
  status: "approved" | "pending" | "rejected" | "cancelled";
  /** Amount in the payment's NATIVE currency (ARS for MP). */
  amount: number;
  /** ISO currency code of `amount` ("ARS" for MP). */
  currency: string;
  /** Provider fee breakdown, when present. */
  fee_details?: Array<{ type: string; amount: number }>;
  /** Our orderId, echoed back by the provider. */
  external_reference: string;
}

/** Outcome of a refund request. */
export interface RefundResult {
  success: boolean;
  refundId?: string;
  reason?: string;
}

/**
 * Provider-agnostic payment contract. Implementations are stateless adapters
 * that read their own credentials from the Convex env (never from files).
 */
export interface PaymentProvider {
  /** Open a hosted checkout session for the given order. */
  createCheckoutSession(order: CheckoutOrderInput): Promise<CheckoutSession>;

  /** Verify an inbound webhook's signature and classify its intent. */
  verifyWebhook(
    payload: unknown,
    headers: Record<string, string>
  ): Promise<WebhookVerification>;

  /** Authoritatively fetch a payment's current state from the provider API. */
  fetchPaymentState(externalId: string): Promise<PaymentState>;

  /** Refund a payment in full (no `amount`) or partially. */
  refund(paymentId: string, amount?: number): Promise<RefundResult>;
}

/** Provider discriminator for future multi-PSP routing. */
export enum PaymentProviderType {
  MERCADO_PAGO = "mercado_pago",
  STRIPE = "stripe", // future V1.x
  DLOCAL = "dlocal", // future V1.x
}
