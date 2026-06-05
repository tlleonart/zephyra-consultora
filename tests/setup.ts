/**
 * Global vitest setup.
 *
 * The HMAC key MUST be set BEFORE any test file imports convex/model/passwords
 * because that module caches the resolved CryptoKey at first call via a
 * module-level closure. setupFiles run before any test module loads, so this
 * is the correct seam.
 *
 * The value is a fixed 64-hex string (deterministic) so legacy/hmac discrimination
 * in opaque-token tests is reproducible across runs.
 */
process.env.MAGIC_LINK_HMAC_KEY ??=
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

// SESSION_SECRET is read by middleware.ts when verifying admin JWTs; the
// middleware test signs tokens with the same key so the verify path succeeds.
process.env.SESSION_SECRET ??= "test-session-secret-not-for-production-use";
