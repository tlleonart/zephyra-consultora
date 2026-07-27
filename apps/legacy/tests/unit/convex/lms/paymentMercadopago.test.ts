/**
 * Unit tests for convex/lms/payment/mercadopago.ts — the PURE crypto helpers.
 *
 * Why these specific cases (SDD §7 signed controls):
 *  - Control #1 (webhook authenticity): a valid x-signature must verify; a
 *    tampered hmac, tampered manifest field (id/request-id/ts), or malformed
 *    header must NOT verify. These are the anti-forgery guarantees.
 *  - normalizeMercadoPagoStatus: the MP status family collapse the money-path
 *    branches on (approved vs rejected vs cancelled vs pending).
 *
 * The adapter class itself (fetchPaymentState / constructor env reads) is NOT
 * exercised here — it needs network + env; its logic is the thin fetch wrapper
 * around these pure helpers, covered by the webhook orchestration + the
 * sandbox e2e that Tomás runs at sprint-close.
 *
 * Runtime note: Web Crypto (crypto.subtle) is available in Node 20 natively, so
 * these HMAC computations run unmodified in vitest's node environment.
 */
import { describe, it, expect } from "vitest";
import {
  parseMercadoPagoSignatureHeader,
  verifyMercadoPagoSignature,
  normalizeMercadoPagoStatus,
} from "../../../../convex/lms/payment/mercadopago";

const SECRET = "mp-test-webhook-secret-0123456789";

// Compute a valid v1 hmac the same way the verifier does, so a "valid" test
// fixture is self-consistent (mirrors how MP signs the manifest).
async function signManifest(args: {
  dataId: string | null;
  requestId: string | null;
  ts: string;
  secret: string;
}): Promise<string> {
  let manifest = "";
  if (args.dataId) manifest += `id:${args.dataId};`;
  if (args.requestId) manifest += `request-id:${args.requestId};`;
  manifest += `ts:${args.ts};`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(args.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(manifest)
  );
  const bytes = new Uint8Array(sig);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

describe("parseMercadoPagoSignatureHeader", () => {
  it("parses a well-formed ts=...,v1=... header", () => {
    const parsed = parseMercadoPagoSignatureHeader("ts=1700000000,v1=abc123");
    expect(parsed).toEqual({ ts: "1700000000", v1: "abc123" });
  });

  it("is order- and whitespace-tolerant", () => {
    const parsed = parseMercadoPagoSignatureHeader(" v1=deadbeef , ts=42 ");
    expect(parsed).toEqual({ ts: "42", v1: "deadbeef" });
  });

  it("returns null when ts is missing", () => {
    expect(parseMercadoPagoSignatureHeader("v1=abc")).toBeNull();
  });

  it("returns null when v1 is missing", () => {
    expect(parseMercadoPagoSignatureHeader("ts=1")).toBeNull();
  });
});

describe("verifyMercadoPagoSignature — control #1 (authenticity)", () => {
  const ts = "1718800000";
  const dataId = "mp-payment-123";
  const requestId = "req-abc";

  it("accepts a correctly signed manifest", async () => {
    const v1 = await signManifest({ dataId, requestId, ts, secret: SECRET });
    const ok = await verifyMercadoPagoSignature({
      signatureHeader: `ts=${ts},v1=${v1}`,
      requestId,
      dataId,
      secret: SECRET,
    });
    expect(ok).toBe(true);
  });

  it("rejects a tampered hmac (forged v1)", async () => {
    const ok = await verifyMercadoPagoSignature({
      signatureHeader: `ts=${ts},v1=${"0".repeat(64)}`,
      requestId,
      dataId,
      secret: SECRET,
    });
    expect(ok).toBe(false);
  });

  it("rejects when the data.id is swapped (manifest tamper)", async () => {
    const v1 = await signManifest({ dataId, requestId, ts, secret: SECRET });
    const ok = await verifyMercadoPagoSignature({
      signatureHeader: `ts=${ts},v1=${v1}`,
      requestId,
      dataId: "mp-payment-DIFFERENT",
      secret: SECRET,
    });
    expect(ok).toBe(false);
  });

  it("rejects when the timestamp is swapped (replay-binding tamper)", async () => {
    const v1 = await signManifest({ dataId, requestId, ts, secret: SECRET });
    const ok = await verifyMercadoPagoSignature({
      signatureHeader: `ts=9999999999,v1=${v1}`,
      requestId,
      dataId,
      secret: SECRET,
    });
    expect(ok).toBe(false);
  });

  it("rejects when signed with a different secret", async () => {
    const v1 = await signManifest({ dataId, requestId, ts, secret: "wrong-secret" });
    const ok = await verifyMercadoPagoSignature({
      signatureHeader: `ts=${ts},v1=${v1}`,
      requestId,
      dataId,
      secret: SECRET,
    });
    expect(ok).toBe(false);
  });

  it("rejects a missing signature header", async () => {
    const ok = await verifyMercadoPagoSignature({
      signatureHeader: null,
      requestId,
      dataId,
      secret: SECRET,
    });
    expect(ok).toBe(false);
  });

  it("rejects a malformed signature header", async () => {
    const ok = await verifyMercadoPagoSignature({
      signatureHeader: "garbage",
      requestId,
      dataId,
      secret: SECRET,
    });
    expect(ok).toBe(false);
  });

  it("rejects when the secret is empty", async () => {
    const ok = await verifyMercadoPagoSignature({
      signatureHeader: `ts=${ts},v1=abc`,
      requestId,
      dataId,
      secret: "",
    });
    expect(ok).toBe(false);
  });

  it("verifies the manifest WITHOUT request-id when none is delivered", async () => {
    const v1 = await signManifest({ dataId, requestId: null, ts, secret: SECRET });
    const ok = await verifyMercadoPagoSignature({
      signatureHeader: `ts=${ts},v1=${v1}`,
      requestId: null,
      dataId,
      secret: SECRET,
    });
    expect(ok).toBe(true);
  });
});

describe("normalizeMercadoPagoStatus", () => {
  it("maps approved", () => {
    expect(normalizeMercadoPagoStatus("approved")).toBe("approved");
  });
  it("maps cancelled", () => {
    expect(normalizeMercadoPagoStatus("cancelled")).toBe("cancelled");
  });
  it("maps rejected + charged_back to rejected", () => {
    expect(normalizeMercadoPagoStatus("rejected")).toBe("rejected");
    expect(normalizeMercadoPagoStatus("charged_back")).toBe("rejected");
  });
  it("collapses pending/in_process/authorized/unknown to pending", () => {
    for (const s of ["pending", "in_process", "authorized", "in_mediation", "refunded", "weird"]) {
      expect(normalizeMercadoPagoStatus(s)).toBe("pending");
    }
  });
});
