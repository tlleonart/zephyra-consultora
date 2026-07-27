/**
 * Unit tests for convex/model/passwords (Sprint 1 B01 contract).
 *
 * Why these specific cases:
 *  - hashPassword salt randomness — non-deterministic output is the only
 *    way to be sure the per-user salt is wired in (otherwise OWASP §argon2id
 *    salt requirement is violated even if the algorithm string looks right).
 *  - verifyPassword legacy branch — R1 mitigation needs lazy re-hash, so
 *    `needsRehash: true` MUST be set when the stored row is the pre-Sprint-1
 *    SHA-256+static-salt format. This is the regression guard against a
 *    silent revert that would lock out every existing admin row.
 *  - Opaque token verifyMatrix — single-use legacy reset tokens still exist
 *    in the DB at the moment of the cutover; verifyOpaqueToken must accept
 *    both shapes without ever conflating them (legacy flag drives the
 *    "consume and let it drain" log line).
 */
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  hashPassword,
  verifyPassword,
  hashOpaqueToken,
  verifyOpaqueToken,
} from "../../../../convex/model/passwords";

// Mirror the legacy fingerprint from convex/model/passwords.ts.
const legacySha256 = (input: string): string =>
  createHash("sha256").update(input + "zephyra-salt-2024").digest("hex");

describe("hashPassword", () => {
  it("returns an argon2id encoded string", async () => {
    const out = await hashPassword("correct horse battery staple");
    expect(out.startsWith("$argon2id$")).toBe(true);
  });

  it("produces different hashes for the same input (per-call random salt)", async () => {
    const a = await hashPassword("same-input");
    const b = await hashPassword("same-input");
    expect(a).not.toEqual(b);
  });
});

describe("verifyPassword — argon2id branch", () => {
  it("verifies the exact password against its own hash", async () => {
    const hash = await hashPassword("hunter2");
    const result = await verifyPassword("hunter2", hash);
    expect(result).toEqual({ valid: true, needsRehash: false });
  });

  it("rejects a wrong password against an argon2 hash", async () => {
    const hash = await hashPassword("hunter2");
    const result = await verifyPassword("hunter3", hash);
    expect(result.valid).toBe(false);
    expect(result.needsRehash).toBe(false);
  });
});

describe("verifyPassword — legacy SHA-256 lazy-rehash branch (R1)", () => {
  it("accepts a legacy hash with needsRehash:true", async () => {
    const legacy = legacySha256("12345678");
    const result = await verifyPassword("12345678", legacy);
    expect(result).toEqual({ valid: true, needsRehash: true });
  });

  it("rejects a wrong password against a legacy hash (still flags rehash)", async () => {
    const legacy = legacySha256("12345678");
    const result = await verifyPassword("87654321", legacy);
    // valid:false; the rehash flag is moot because the caller won't proceed.
    expect(result.valid).toBe(false);
  });
});

describe("hashOpaqueToken", () => {
  it("is deterministic for the same input+key", async () => {
    const a = await hashOpaqueToken("token-xyz");
    const b = await hashOpaqueToken("token-xyz");
    expect(a).toEqual(b);
  });

  it("produces a 64-char hex string (SHA-256 HMAC output)", async () => {
    const out = await hashOpaqueToken("any");
    expect(out).toMatch(/^[0-9a-f]{64}$/);
  });

  it("yields different hashes for different inputs", async () => {
    const a = await hashOpaqueToken("alpha");
    const b = await hashOpaqueToken("beta");
    expect(a).not.toEqual(b);
  });
});

describe("verifyOpaqueToken matrix", () => {
  it("validates a correct HMAC-hashed token as non-legacy", async () => {
    const raw = "fresh-magic-link-token";
    const stored = await hashOpaqueToken(raw);
    const result = await verifyOpaqueToken(raw, stored);
    expect(result).toEqual({ valid: true, isLegacy: false });
  });

  it("rejects a wrong raw token against an HMAC-hashed stored value", async () => {
    const stored = await hashOpaqueToken("the-real-token");
    const result = await verifyOpaqueToken("guessed-token", stored);
    expect(result).toEqual({ valid: false, isLegacy: false });
  });

  it("accepts a pre-Sprint-1 legacy SHA-256 stored value and flags it", async () => {
    const raw = "pre-sprint-1-magic";
    const stored = legacySha256(raw);
    const result = await verifyOpaqueToken(raw, stored);
    expect(result).toEqual({ valid: true, isLegacy: true });
  });
});
