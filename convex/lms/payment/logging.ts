/**
 * LMS — Structured money-path logging (Sprint 2 Phase P2.1).
 *
 * Every money-path event is emitted as a single-line JSON object so the Convex
 * Logs sink can be grep'd / filtered by correlation key (orderId, mpPaymentId,
 * learnerId, courseId). Convex's console.* captures the argument and surfaces it
 * in the Logs tab; emitting ONE JSON string (not multiple positional args) keeps
 * each event on one queryable line.
 *
 * WHY a helper instead of ad-hoc console.* with string interpolation:
 *   The P0/P1 handlers logged with free-form template strings
 *   (`order=... payment=...`), which are not machine-filterable and inconsistent
 *   across call sites. logMoney enforces a fixed envelope (timestamp/level/
 *   message/event + a typed context bag) so a single Convex Logs query on, e.g.,
 *   `mpPaymentId` returns the whole lifecycle of one payment across handlers.
 *
 * PII / secret hygiene (SDD §7, P2.2 audit):
 *   - NEVER pass card data, full payer PII, or any MP credential into `ctx`.
 *   - Email addresses are PII: we log a learnerId (opaque Convex id), never the
 *     buyer's email. The email mailer logs the address only in the dev fallback
 *     (no SMTP creds), which never runs in prod.
 *   - The MP fee breakdown / amounts are business data, not PII — safe to log.
 *
 * This module is pure (only console.*); it has no ctx/db/env/network, so it is
 * importable from V8 isolate code (mutations, httpActions) AND "use node"
 * actions alike.
 */

/** The fixed set of money-path events. Closed union — add here, not ad-hoc. */
export type MoneyEvent =
  | "order_created"
  | "checkout_preference_created"
  | "webhook_received"
  | "signature_verified"
  | "signature_rejected"
  | "payment_state_fetched"
  | "payment_state_fetch_failed"
  | "payment_approved"
  | "payment_rejected"
  | "payment_cancelled"
  | "payment_pending"
  | "order_not_found"
  | "amount_mismatch"
  | "webhook_idempotent_noop"
  | "enrollment_granted"
  | "revenue_share_recorded"
  | "confirmation_email_sent"
  | "confirmation_email_skipped"
  | "provider_not_configured"
  // Sprint 3a (Sales Pack) money-path events.
  | "pack_order_created"
  // A stale pending pack order cancelled because its snapshot no longer matched
  // the freshly recomputed quote (e.g. abandoned 10-seat order, new 25-seat req).
  | "pack_order_superseded"
  | "pack_checkout_preference_created"
  | "seat_pack_minted"
  | "seat_pack_mint_idempotent_noop";

type LogLevel = "info" | "warn" | "error";

/**
 * Correlation context. All fields optional so a call site supplies only what it
 * holds. The keys are the queryable join keys across the money path. NO PII or
 * secrets: learnerId/courseId/orderId/mpPaymentId are opaque ids, amounts and
 * the split are business figures.
 */
export interface MoneyLogContext {
  orderId?: string;
  mpPaymentId?: string;
  mpPreferenceId?: string;
  externalReference?: string;
  learnerId?: string;
  courseId?: string;
  enrollmentId?: string;
  revenueShareId?: string;
  // Sprint 3a (Sales Pack) correlation keys — all opaque ids / business figures.
  organizationId?: string;
  seatPackId?: string;
  seatCount?: number;
  amountArs?: number;
  amountUsd?: number;
  splitC14Usd?: number;
  splitZephyraUsd?: number;
  mpFees?: number;
  currency?: string;
  status?: string;
  reason?: string;
  requestId?: string;
}

/**
 * Emit a structured money-path log line.
 *
 * @param level   info | warn | error — maps to console.info/warn/error
 * @param event   one of the closed MoneyEvent union (also the `event` field)
 * @param message human-readable summary (no secrets, no PII)
 * @param ctx     correlation keys (orderId / mpPaymentId / ...) — no PII/secrets
 */
export function logMoney(
  level: LogLevel,
  event: MoneyEvent,
  message: string,
  ctx: MoneyLogContext = {}
): void {
  // Drop undefined keys so each line is compact and only carries what's known.
  const context: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(ctx)) {
    if (val !== undefined) context[k] = val;
  }

  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    domain: "lms.payment",
    event,
    message,
    ...context,
  });

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
