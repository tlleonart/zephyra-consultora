/**
 * Unit tests for src/features/auth-learner/lib/session.ts (apps/academia).
 *
 * Scope (avoid the cookies()-bound surface, which only works in a Next.js
 * request context — those are integration territory):
 *   1. Round-trip: createLearnerSession -> verifyLearnerSession returns the
 *      original payload fields.
 *   2. ACADEMIA'S HALF of the cross-surface escalation guard.
 *
 * SPLIT NOTE (T-fe-008) — why this file does not import the admin module.
 *
 * Before the split, apps/legacy/tests/unit/features/auth-learner/session.test.ts
 * was the ONLY file in the repo importing BOTH session surfaces, and it proved
 * the boundary in both directions. After the split no workspace holds both:
 * features/auth lives in apps/backoffice, features/auth-learner lives here.
 * Every cross-workspace option was worse — importing apps/backoffice from here
 * would couple two sibling apps, and putting the test in packages/* would
 * invert the dependency graph (a package importing an app).
 *
 * The ruled arrangement: the guard needs ONE implementation plus a token minted
 * with the OTHER secret — not both implementations. An admin token is, from
 * this app's point of view, exactly "an HS256 JWT signed with a key that is not
 * LEARNER_JWT_SECRET, carrying an admin-shaped payload". That is reproducible
 * inline with `jose`, which is what the escalation-guard describe below does.
 * apps/backoffice gets the mirror half (a LEARNER_JWT_SECRET-minted token
 * rejected by verifySession) at T-fe-009, which may not delete apps/legacy
 * until BOTH halves are green. Until then apps/legacy retains byte-identical
 * copies of both session modules purely so the original two-directional guard
 * keeps running.
 *
 * WHY THE SECRET IS A LOCAL CONSTANT AND NOT process.env.SESSION_SECRET:
 * this app has no SESSION_SECRET (see .env.local.example and tests/setup.ts) —
 * reading one from the environment here would reintroduce the coupling the
 * split removes, and would silently no-op into the fallback if the var were
 * ever dropped from CI. The inequality with LEARNER_JWT_SECRET is asserted
 * explicitly below, so the guard cannot be defeated by the two secrets
 * accidentally converging.
 */
import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import {
  createLearnerSession,
  verifyLearnerSession,
} from "../../../../src/features/auth-learner/lib/session";
import { Id } from "@zephyra/convex/_generated/dataModel";

const learnerInput = {
  _id: "lms_c14_smoke_learner_id" as unknown as Id<"lmsCustomers">,
  email: "learner@example.com",
  type: "individual" as const,
};

// A SESSION_SECRET-STYLE value: the admin surface's signing key, as seen from
// this app. Same shape and algorithm as the real one, deliberately different
// value, deliberately not read from process.env.
const ADMIN_STYLE_SECRET = "test-session-secret-not-for-production-use";
const adminStyleKey = new TextEncoder().encode(ADMIN_STYLE_SECRET);

// Mirrors features/auth/lib/session.ts's createSession payload shape.
const mintAdminStyleToken = async (): Promise<string> =>
  await new SignJWT({
    userId: "admin_c14_smoke_user_id",
    email: "admin@example.com",
    name: "Smoke Admin",
    role: "admin",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(adminStyleKey);

describe("learner session — happy path", () => {
  it("round-trips a freshly-minted learner token", async () => {
    const token = await createLearnerSession(learnerInput);
    const payload = await verifyLearnerSession(token);
    expect(payload).not.toBeNull();
    expect(payload?.learnerId).toBe(learnerInput._id);
    expect(payload?.email).toBe(learnerInput.email);
    expect(payload?.type).toBe("individual");
  });

  it("returns null for a malformed learner token", async () => {
    const payload = await verifyLearnerSession("not-a-real-jwt");
    expect(payload).toBeNull();
  });
});

describe("learner session — cross-surface escalation guard (academia half)", () => {
  it("the two signing keys are genuinely distinct (precondition of the guard)", () => {
    // If these ever converge the rejection test below would pass for the wrong
    // reason. Assert the precondition rather than trusting it.
    expect(process.env.LEARNER_JWT_SECRET).toBeDefined();
    expect(process.env.LEARNER_JWT_SECRET).not.toBe(ADMIN_STYLE_SECRET);
  });

  it("rejects an admin-style token (minted with the OTHER secret) on the learner verify path", async () => {
    const adminToken = await mintAdminStyleToken();
    const result = await verifyLearnerSession(adminToken);
    // Distinct signing keys + different payload shape; the verify call MUST
    // fail signature validation and return null. If this ever returns a
    // payload, an admin cookie would be honored as a learner — CRITICAL BUG.
    expect(result).toBeNull();
  });

  it("rejects an admin-style token even when it carries a learner-shaped payload", async () => {
    // Belt and braces: the guard must rest on the SIGNATURE, not on payload
    // shape. A forged token claiming to be a learner, signed with the admin
    // key, must still be rejected.
    const forged = await new SignJWT({
      learnerId: learnerInput._id,
      email: learnerInput.email,
      type: "org_admin",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(adminStyleKey);
    expect(await verifyLearnerSession(forged)).toBeNull();
  });
});
