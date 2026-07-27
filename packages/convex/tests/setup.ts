/**
 * Global vitest setup for the @zephyra/convex suite.
 *
 * The HMAC key MUST be set BEFORE any test file imports convex/model/passwords
 * because that module caches the resolved CryptoKey at first call via a
 * module-level closure. setupFiles run before any test module loads, so this is
 * the correct seam.
 *
 * The value is a fixed 64-hex string (deterministic) so legacy/hmac
 * discrimination in opaque-token tests is reproducible across runs. It is the
 * same literal apps/legacy/tests/setup.ts uses and the same one ci.yml pins for
 * MAGIC_LINK_HMAC_KEY, so the two suites cannot drift into disagreeing about
 * which key produced a token.
 *
 * MAGIC_LINK_HMAC_KEY is the ONLY var seeded here. The app's setup also seeds
 * SESSION_SECRET and LEARNER_JWT_SECRET, but both are read exclusively by
 * src/middleware.ts and src/features/** — no convex module reads either, so
 * seeding them in this package would be cargo cult. Everything else the convex
 * suites touch (MP_*, EMAIL_*, CONVEX_SITE_URL, ZEPHYRA_PUBLIC_URL) is assigned
 * by the suites themselves, which is why they pass under turbo's strict env mode
 * without those vars being declared in turbo.json.
 */
process.env.MAGIC_LINK_HMAC_KEY ??=
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
