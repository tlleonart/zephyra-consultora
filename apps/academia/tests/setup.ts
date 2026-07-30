/**
 * Global vitest setup for apps/academia.
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

// LEARNER_JWT_SECRET is the distinct signing key for the learner cookie
// ('session-learner'). It is the ONLY session secret this app has.
process.env.LEARNER_JWT_SECRET ??=
  "test-learner-jwt-secret-not-for-production-use";

// SESSION_SECRET is deliberately NOT set here, although apps/legacy's
// setup.ts did set it for the admin middleware branch. This app has no admin
// session surface: no SESSION_SECRET in .env.local.example, no admin verify
// path in the middleware bundle, no features/auth module. The cross-surface
// escalation guard in tests/unit/features/auth-learner/session.test.ts
// therefore mints its "other secret" token from a LOCAL constant instead of
// from the environment — see the docblock there. Setting SESSION_SECRET here
// would reintroduce, in tests, exactly the coupling the split removes.
