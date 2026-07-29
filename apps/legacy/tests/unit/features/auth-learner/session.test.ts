/**
 * Unit tests for src/features/auth-learner/lib/session.ts.
 *
 * Scope (avoid the cookies()-bound surface, which only works in a Next.js
 * request context — those are integration territory):
 *   1. Round-trip: createLearnerSession → verifyLearnerSession returns the
 *      original payload fields.
 *   2. Cross-surface escalation guards (the security gate of C03):
 *      - an admin-minted token MUST NOT validate against verifyLearnerSession
 *      - a learner-minted token MUST NOT validate against the admin
 *        verifySession path.
 *
 * The distinct secrets (SESSION_SECRET vs LEARNER_JWT_SECRET) are set in
 * tests/setup.ts; the cross-surface tests rely on those being different.
 *
 * SPLIT NOTE (T-fe-007). This is the only file in the repo that imports BOTH
 * session surfaces, so the app split has no home for it: the admin module went
 * to apps/backoffice and the learner module goes to apps/academia at T-fe-008,
 * and after that no single workspace contains both. apps/legacy therefore
 * retains a byte-identical COPY of src/features/auth/lib/session.ts purely so
 * this guard keeps compiling and running until T-fe-009 redistributes the
 * suite. Nothing in apps/legacy's own source imports that copy — do not build
 * on it. The guard itself must NOT be dropped: it is the cross-surface
 * escalation gate (PDD §7.5, SDD §6 SC #3), and once the modules live in two
 * apps it needs a real home (a shared test package, or an E2E assertion across
 * the two deployed hosts).
 */
import { describe, it, expect } from "vitest";
import {
  createLearnerSession,
  verifyLearnerSession,
} from "../../../../src/features/auth-learner/lib/session";
import {
  createSession,
  verifySession,
} from "../../../../src/features/auth/lib/session";
import { Id } from "@zephyra/convex/_generated/dataModel";

const learnerInput = {
  _id: "lms_c14_smoke_learner_id" as unknown as Id<"lmsCustomers">,
  email: "learner@example.com",
  type: "individual" as const,
};

const adminInput = {
  _id: "admin_c14_smoke_user_id" as unknown as Id<"adminUsers">,
  email: "admin@example.com",
  name: "Smoke Admin",
  role: "admin" as const,
};

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

describe("learner session — cross-surface escalation guard", () => {
  it("rejects an admin-minted token on the learner verify path", async () => {
    const adminToken = await createSession(adminInput);
    const result = await verifyLearnerSession(adminToken);
    // Distinct signing keys + different payload shape; the verify call MUST
    // fail signature validation and return null. If this ever returns a
    // payload, an admin cookie would be honored as a learner — CRITICAL BUG.
    expect(result).toBeNull();
  });

  it("rejects a learner-minted token on the admin verify path", async () => {
    const learnerToken = await createLearnerSession(learnerInput);
    const result = await verifySession(learnerToken);
    // Same boundary, opposite direction. A learner cookie must never satisfy
    // admin verify. The /admin/lms surface relies on this.
    expect(result).toBeNull();
  });
});
