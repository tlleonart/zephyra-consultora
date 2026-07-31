/**
 * Global vitest setup for apps/backoffice (added at T-fe-009).
 *
 * SESSION_SECRET is read (lazily, via getSecretKey) by
 * src/features/auth/lib/session.ts and (eagerly, at module scope) by
 * src/middleware.ts. It is the ONLY session secret this app has.
 *
 * LEARNER_JWT_SECRET is deliberately NOT set here — the exact mirror of
 * apps/academia/tests/setup.ts, which deliberately does not set SESSION_SECRET.
 * This app has no learner session surface: no LEARNER_JWT_SECRET in
 * .env.local.example, no learner verify path in the middleware bundle, no
 * features/auth-learner module. The backoffice half of the cross-surface
 * escalation guard (tests/unit/features/auth/session.test.ts) therefore mints
 * its "other secret" token from a LOCAL constant instead of from the
 * environment. Setting LEARNER_JWT_SECRET here would reintroduce, in tests,
 * exactly the coupling the app split removes — and would make the guard depend
 * on a var that CI does not define for the `test` job.
 *
 * `??=` (not `=`) so a caller-provided value wins; CI's test job pins the same
 * literal (.github/workflows/ci.yml) and turbo.json declares SESSION_SECRET on
 * the `test` task, without which turbo's strict env mode would deliver it as
 * undefined.
 */
process.env.SESSION_SECRET ??= "test-session-secret-not-for-production-use";
