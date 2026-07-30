/**
 * Unit tests for apps/academia/src/middleware.ts — LEARNER BRANCH ONLY.
 *
 * apps/legacy's tests/unit/middleware.test.ts covered both branches in one file
 * because one middleware carried both. After the split there are three
 * middlewares (www: none, backoffice: admin, academia: learner), so the suite
 * splits with them. This file is the learner half, ported verbatim in intent
 * from that file's "learner protected route branch" describe.
 *
 * Two assertions from the original could not come along and are called out
 * rather than dropped silently:
 *   - the four ADMIN-branch cases (/admin redirects to /login, /login bounce)
 *     have no subject here — this bundle has no admin branch at all. They live
 *     in apps/backoffice's middleware (currently untested — T-fe-007 issue #4).
 *   - "redirects /admin/lms/courses to /login when only a session-learner
 *     cookie is present (inverse cross-surface guard)" needed the admin branch
 *     to do the redirecting. On this host /admin is not a route at all, so the
 *     property becomes stronger and different: the request simply falls through
 *     (asserted below) and reaches a 404 — an admin surface cannot be reached
 *     from the academia host by any cookie. The escalation direction that DOES
 *     have a subject here (an admin cookie must not open the player) is kept.
 *
 * The admin-style token is signed with a LOCAL constant, not
 * process.env.SESSION_SECRET: this app has no SESSION_SECRET (tests/setup.ts).
 */
import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { middleware } from "../../src/middleware";

// The admin surface's signing key as seen from this app: same algorithm,
// deliberately different value, deliberately not from the environment.
const ADMIN_STYLE_SECRET = new TextEncoder().encode(
  "test-session-secret-not-for-production-use"
);

const LEARNER_SECRET = new TextEncoder().encode(
  process.env.LEARNER_JWT_SECRET ??
    "test-learner-jwt-secret-not-for-production-use"
);

const signAdminStyleSession = async (): Promise<string> => {
  return await new SignJWT({ sub: "user-1", role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(ADMIN_STYLE_SECRET);
};

const signValidLearnerSession = async (): Promise<string> => {
  return await new SignJWT({
    learnerId: "lms-customer-1",
    email: "learner@example.com",
    type: "individual",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(LEARNER_SECRET);
};

const makeRequest = (url: string, cookieHeader?: string): NextRequest => {
  const headers = new Headers();
  if (cookieHeader) headers.set("cookie", cookieHeader);
  return new NextRequest(new URL(url), { headers });
};

describe("middleware — learner protected route branch", () => {
  it("redirects an anonymous request to /cursos/<slug>/player to /cursos/auth/signin with returnTo", async () => {
    const req = makeRequest(
      "http://localhost:3000/cursos/intro-to-x/player"
    );
    const res = await middleware(req);
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).not.toBeNull();
    const url = new URL(location!);
    expect(url.pathname).toBe("/cursos/auth/signin");
    expect(url.searchParams.get("returnTo")).toBe("/cursos/intro-to-x/player");
  });

  it("passes through /cursos/<slug>/player with a valid session-learner cookie", async () => {
    const token = await signValidLearnerSession();
    const req = makeRequest(
      "http://localhost:3000/cursos/intro-to-x/player",
      `session-learner=${token}`
    );
    const res = await middleware(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects /cursos/<slug>/player to learner signin when only an admin-style session cookie is present (cross-surface guard)", async () => {
    const adminToken = await signAdminStyleSession();
    const req = makeRequest(
      "http://localhost:3000/cursos/intro-to-x/player",
      `session=${adminToken}`
    );
    const res = await middleware(req);
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).not.toBeNull();
    const url = new URL(location!);
    expect(url.pathname).toBe("/cursos/auth/signin");
  });

  it("redirects an authenticated learner away from /cursos/auth/signin to /cursos", async () => {
    const token = await signValidLearnerSession();
    const req = makeRequest(
      "http://localhost:3000/cursos/auth/signin",
      `session-learner=${token}`
    );
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/cursos$/);
  });

  it("passes through /cursos/auth/signin when no cookie is present (form must render)", async () => {
    const req = makeRequest("http://localhost:3000/cursos/auth/signin");
    const res = await middleware(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through /cursos (catalog) anonymously — route is PUBLIC", async () => {
    const req = makeRequest("http://localhost:3000/cursos");
    const res = await middleware(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through /cursos/<slug> (detail) anonymously — route is PUBLIC", async () => {
    const req = makeRequest("http://localhost:3000/cursos/intro-to-x");
    const res = await middleware(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through /empresa/* — the B2B surface is not learner-gated here", async () => {
    // /empresa keeps its prefix on this host (boundaries v1.1 §3.1 D2). Org
    // authority is enforced server-side (requireOrgOwner + callerCustomerId),
    // not in middleware; a middleware gate here would break /empresa/registro
    // and /empresa/invitacion, which are pre-session entry points.
    for (const path of [
      "/empresa",
      "/empresa/cursos",
      "/empresa/registro",
      "/empresa/invitacion",
    ]) {
      const res = await middleware(makeRequest(`http://localhost:3000${path}`));
      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    }
  });
});

describe("middleware — dropped and absent surfaces", () => {
  it("does NOT gate /cursos/mis-cursos (dead matcher entry removed)", async () => {
    // apps/legacy protected this path, but the page never existed, so the entry
    // gated a 404 (boundaries §3, "Resolved ambiguities"). It must not be
    // carried over. Anonymous request falls through instead of redirecting.
    const res = await middleware(
      makeRequest("http://localhost:3000/cursos/mis-cursos")
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("has no admin branch: /admin/lms/courses is never redirected to /login", async () => {
    // Structural assertion of the auth separation. Not "an admin cookie is
    // rejected" — there is no admin verify path in this bundle to reject it
    // with. The admin surface simply does not exist on this host.
    const anon = await middleware(
      makeRequest("http://localhost:3000/admin/lms/courses")
    );
    expect(anon.status).toBe(200);
    expect(anon.headers.get("location")).toBeNull();

    const withLearner = await middleware(
      makeRequest(
        "http://localhost:3000/admin/lms/courses",
        `session-learner=${await signValidLearnerSession()}`
      )
    );
    expect(withLearner.status).toBe(200);
    expect(withLearner.headers.get("location")).toBeNull();
  });
});
