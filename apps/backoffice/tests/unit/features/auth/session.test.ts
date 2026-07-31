/**
 * Unit tests for src/features/auth/lib/session.ts (apps/backoffice).
 *
 * Scope (avoid the cookies()-bound surface — getSession/setSessionCookie only
 * work in a Next.js request context; those are integration territory):
 *   1. Round-trip: createSession -> verifySession returns the original payload.
 *   2. BACKOFFICE'S HALF of the cross-surface escalation guard.
 *
 * SPLIT NOTE (T-fe-009) — this is the second and final half of the guard.
 *
 * Before the split, apps/legacy/tests/unit/features/auth-learner/session.test.ts
 * was the only file in the repo importing BOTH session surfaces and it proved
 * the boundary in both directions:
 *   - "rejects an admin-minted token on the learner verify path"  -> re-homed to
 *     apps/academia at T-fe-008 (tests/unit/features/auth-learner/session.test.ts,
 *     describe "cross-surface escalation guard (academia half)").
 *   - "rejects a learner-minted token on the admin verify path"   -> THIS FILE.
 * apps/legacy could not be deleted until both halves were green; that is the
 * hard gate T-fe-009 was held to.
 *
 * After the split no workspace holds both modules: features/auth lives here,
 * features/auth-learner lives in apps/academia. Importing a sibling app would
 * couple the two, and putting the test in packages/* would invert the
 * dependency graph (a package importing an app). Neither is acceptable.
 *
 * The ruled arrangement: the guard needs ONE implementation plus a token minted
 * with the OTHER secret — not both implementations. A learner token is, from
 * this app's point of view, exactly "an HS256 JWT signed with a key that is not
 * SESSION_SECRET, carrying a learner-shaped payload". That is reproducible
 * inline with `jose`, which is what the escalation-guard describe below does.
 *
 * WHY THE SECRET IS A LOCAL CONSTANT AND NOT process.env.LEARNER_JWT_SECRET:
 * this app has no LEARNER_JWT_SECRET (see .env.local.example and tests/setup.ts)
 * and CI's test job does not set one. Reading it from the environment here
 * would reintroduce the coupling the split removes AND would silently no-op
 * into a fallback if the var were absent — a guard that passes because both
 * sides signed with the same undefined-derived key is not a guard. The
 * inequality with SESSION_SECRET is asserted explicitly below so the guard
 * cannot be defeated by the two secrets accidentally converging.
 */
import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import { createSession, verifySession } from "../../../../src/features/auth/lib/session";
import { Id } from "@zephyra/convex/_generated/dataModel";

const adminInput = {
  _id: "admin_c14_smoke_user_id" as unknown as Id<"adminUsers">,
  email: "admin@example.com",
  name: "Smoke Admin",
  role: "admin" as const,
};

// A LEARNER_JWT_SECRET-STYLE value: the learner surface's signing key, as seen
// from this app. Same shape and algorithm as the real one, deliberately
// different value, deliberately not read from process.env. Kept byte-identical
// to the literal apps/academia/tests/setup.ts uses for LEARNER_JWT_SECRET, so
// this really is the other surface's key and not an arbitrary string.
const LEARNER_STYLE_SECRET = "test-learner-jwt-secret-not-for-production-use";
const learnerStyleKey = new TextEncoder().encode(LEARNER_STYLE_SECRET);

// Mirrors apps/academia's features/auth-learner/lib/session.ts createLearnerSession
// payload shape.
const mintLearnerStyleToken = async (
  claims: Record<string, unknown> = {
    learnerId: "lms_c14_smoke_learner_id",
    email: "learner@example.com",
    type: "individual",
  }
): Promise<string> =>
  await new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(learnerStyleKey);

describe("admin session — happy path", () => {
  // POSITIVE CONTROL. Without this, a harness bug that made every verify call
  // return null would make the escalation guard below pass for entirely the
  // wrong reason: "denied" would be indistinguishable from "broken". This test
  // must SUCCEED for the rejections to mean anything.
  it("round-trips a freshly-minted admin token", async () => {
    const token = await createSession(adminInput);
    const payload = await verifySession(token);
    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe(adminInput._id);
    expect(payload?.email).toBe(adminInput.email);
    expect(payload?.name).toBe(adminInput.name);
    expect(payload?.role).toBe("admin");
  });

  it("returns null for a malformed admin token", async () => {
    expect(await verifySession("not-a-real-jwt")).toBeNull();
  });
});

describe("admin session — cross-surface escalation guard (backoffice half)", () => {
  it("the two signing keys are genuinely distinct (precondition of the guard)", () => {
    // If these ever converge, the rejection tests below would pass for the
    // wrong reason. Assert the precondition rather than trusting it.
    expect(process.env.SESSION_SECRET).toBeDefined();
    expect(process.env.SESSION_SECRET).not.toBe(LEARNER_STYLE_SECRET);
  });

  it("rejects a learner-style token (minted with the OTHER secret) on the admin verify path", async () => {
    const learnerToken = await mintLearnerStyleToken();
    const result = await verifySession(learnerToken);
    // A learner cookie must never satisfy admin verify. The /admin/lms surface
    // relies on this. If this ever returns a payload, any learner could reach
    // the staff CMS — CRITICAL BUG.
    expect(result).toBeNull();
  });

  it("rejects a learner-style token even when it carries an admin-shaped payload", async () => {
    // Belt and braces: the guard must rest on the SIGNATURE, not on payload
    // shape. A forged token claiming role 'superadmin', signed with the learner
    // key, must still be rejected.
    const forged = await mintLearnerStyleToken({
      userId: adminInput._id,
      email: adminInput.email,
      name: adminInput.name,
      role: "superadmin",
    });
    expect(await verifySession(forged)).toBeNull();
  });
});
