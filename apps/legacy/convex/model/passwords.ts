/**
 * Password & opaque-token hashing primitives.
 *
 * Runs in the Convex V8 isolate (no `"use node";` directive). Uses:
 *   - argon2id via `hash-wasm` for password storage (pure WASM, isolate-safe).
 *   - HMAC-SHA-256 via Web Crypto for opaque tokens (random tokens don't need
 *     a memory-hard KDF; HMAC is the right tool and is dramatically faster).
 *
 * Legacy SHA-256 + static salt branches are kept ONLY for lazy verification of
 * rows hashed before Sprint 1. They are NEVER called for new hashing.
 */

import { argon2id, argon2Verify } from "hash-wasm";

// OWASP 2024 recommended parameters for argon2id (interactive login).
// Memory cost expressed in KiB. 19456 KiB == 19 MiB.
const ARGON2_MEMORY_COST_KIB = 19456;
const ARGON2_TIME_COST = 2;
const ARGON2_PARALLELISM = 1;
const ARGON2_HASH_LENGTH = 32;
const ARGON2_SALT_BYTES = 16;

// Legacy static salt for SHA-256 verify branch only.
const LEGACY_STATIC_SALT = "zephyra-salt-2024";

const ARGON2_ENCODED_PREFIX = "$argon2id$";

const toHex = (bytes: Uint8Array): string => {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
};

const legacySha256Hex = async (input: string): Promise<string> => {
  const data = new TextEncoder().encode(input + LEGACY_STATIC_SALT);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(buf));
};

const constantTimeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
};

const getHmacKey = (() => {
  let cached: Promise<CryptoKey> | null = null;
  return (): Promise<CryptoKey> => {
    if (cached) return cached;
    const raw = process.env.MAGIC_LINK_HMAC_KEY;
    if (!raw) {
      // Reset so a subsequent call after env is set will succeed.
      throw new Error(
        "MAGIC_LINK_HMAC_KEY is not set in environment; opaque token hashing requires it."
      );
    }
    // Accept hex; fall back to raw bytes of the string if hex parse fails.
    let keyBytes: Uint8Array;
    if (/^[0-9a-fA-F]+$/.test(raw) && raw.length % 2 === 0) {
      keyBytes = new Uint8Array(raw.length / 2);
      for (let i = 0; i < keyBytes.length; i++) {
        keyBytes[i] = parseInt(raw.substr(i * 2, 2), 16);
      }
    } else {
      keyBytes = new TextEncoder().encode(raw);
    }
    cached = crypto.subtle.importKey(
      "raw",
      keyBytes.buffer.slice(
        keyBytes.byteOffset,
        keyBytes.byteOffset + keyBytes.byteLength
      ) as ArrayBuffer,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    return cached;
  };
})();

/**
 * Hash a password using argon2id with OWASP 2024 parameters.
 * Returns the `encoded` string (includes algorithm, params, salt, hash).
 */
export const hashPassword = async (plain: string): Promise<string> => {
  const salt = crypto.getRandomValues(new Uint8Array(ARGON2_SALT_BYTES));
  return (await argon2id({
    password: plain,
    salt,
    iterations: ARGON2_TIME_COST,
    parallelism: ARGON2_PARALLELISM,
    memorySize: ARGON2_MEMORY_COST_KIB,
    hashLength: ARGON2_HASH_LENGTH,
    outputType: "encoded",
  })) as string;
};

/**
 * Verify a password against a stored hash.
 * Dispatches: argon2id encoded format vs legacy SHA-256+static-salt hex.
 * `needsRehash` is true when the stored hash is legacy — caller should
 * silently re-hash with `hashPassword` and patch the DB row.
 */
export const verifyPassword = async (
  plain: string,
  stored: string
): Promise<{ valid: boolean; needsRehash: boolean }> => {
  if (stored.startsWith(ARGON2_ENCODED_PREFIX)) {
    const valid = await argon2Verify({ password: plain, hash: stored });
    return { valid, needsRehash: false };
  }
  // Legacy SHA-256 + static salt — read-only, lazy-migration path.
  const legacy = await legacySha256Hex(plain);
  return { valid: constantTimeEqual(legacy, stored), needsRehash: true };
};

/**
 * HMAC-SHA-256 a raw opaque token (e.g. password-reset, magic-link).
 * Output is hex. Random opaque tokens have full entropy; HMAC is the right
 * primitive (NOT argon2 — burning CPU on a 256-bit random secret is wasted).
 */
export const hashOpaqueToken = async (rawToken: string): Promise<string> => {
  const key = await getHmacKey();
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawToken)
  );
  return toHex(new Uint8Array(sig));
};

/**
 * Verify a raw token against a stored token hash.
 * Dispatches: HMAC-hex (new, 64 chars) vs legacy SHA-256+static-salt hex (also
 * 64 chars). Both are 64 hex chars, so we cannot tell them apart by shape;
 * we compare against both and report which matched via `isLegacy`. Reset
 * tokens are single-use so legacy rows naturally drain.
 */
export const verifyOpaqueToken = async (
  rawToken: string,
  stored: string
): Promise<{ valid: boolean; isLegacy: boolean }> => {
  const hmac = await hashOpaqueToken(rawToken);
  if (constantTimeEqual(hmac, stored)) {
    return { valid: true, isLegacy: false };
  }
  const legacy = await legacySha256Hex(rawToken);
  if (constantTimeEqual(legacy, stored)) {
    return { valid: true, isLegacy: true };
  }
  return { valid: false, isLegacy: false };
};
