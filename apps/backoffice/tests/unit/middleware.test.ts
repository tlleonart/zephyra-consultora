/**
 * Unit tests for apps/backoffice/src/middleware.ts — ADMIN BRANCH ONLY.
 *
 * apps/legacy's tests/unit/middleware.test.ts covered both branches in one file
 * because one middleware carried both. After the split there are three
 * middlewares (www: none, backoffice: admin, academia: learner), so the suite
 * splits with them. This file is the admin half; apps/academia/tests/unit/
 * middleware.test.ts is the learner half. Disposition of all 12 original
 * assertions is recorded in the T-fe-009 handoff.
 *
 * Ported here from that file (intent preserved, subject unchanged):
 *   - the four "admin protected route branch" cases;
 *   - "redirects /admin/lms/courses to /login when only a session-learner
 *     cookie is present (inverse cross-surface guard)". apps/academia could
 *     only degrade that one into "there is no admin branch here"; its real
 *     subject is this middleware, which is the thing that must do the
 *     redirecting. Restored below with the cookie minted from a
 *     LEARNER_JWT_SECRET-style LOCAL constant (this app has no
 *     LEARNER_JWT_SECRET — see tests/setup.ts).
 *
 * MATCHER COVERAGE — why the last describe exists.
 *
 * Every test that calls `middleware(req)` directly BYPASSES `config.matcher`.
 * Next.js only invokes the middleware for paths the matcher selects, so a
 * broken matcher makes the entire auth gate inert while every behavioural test
 * above still passes — a security guard that dies green. That is not
 * hypothetical: T-fe-009 found this app's matcher literal written with `'\.'`
 * instead of `'\\.'`. In a single-quoted JS string `\.` collapses to `.`, so the
 * "path contains a dot => static asset" exclusion became `.*..*`, which matches
 * ANY non-empty path; the negative lookahead then rejected every route. The
 * compiled regexp in .next/server/middleware-manifest.json confirmed it:
 * /admin, /admin/lms/courses, /login and /reset-password all failed to match,
 * i.e. the admin gate never ran in a real build. The assertions below exercise
 * config.matcher itself so the literal can never silently degrade again.
 */
import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { middleware, config } from "../../src/middleware";

const ADMIN_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "test-session-secret-not-for-production-use"
);

// The learner surface's signing key as seen from this app: same algorithm,
// deliberately different value, deliberately NOT from the environment (this app
// has no LEARNER_JWT_SECRET and CI does not set one for the test job). Kept
// byte-identical to the literal apps/academia/tests/setup.ts uses.
const LEARNER_STYLE_SECRET = new TextEncoder().encode(
  "test-learner-jwt-secret-not-for-production-use"
);

const signValidSession = async (): Promise<string> =>
  await new SignJWT({ sub: "user-1", role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(ADMIN_SECRET);

const signLearnerStyleSession = async (): Promise<string> =>
  await new SignJWT({
    learnerId: "lms-customer-1",
    email: "learner@example.com",
    type: "individual",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(LEARNER_STYLE_SECRET);

const makeRequest = (url: string, cookieHeader?: string): NextRequest => {
  const headers = new Headers();
  if (cookieHeader) headers.set("cookie", cookieHeader);
  return new NextRequest(new URL(url), { headers });
};

describe("middleware — admin protected route branch", () => {
  it("redirects an anonymous request to /admin/lms/... to /login", async () => {
    const req = makeRequest("http://localhost:3000/admin/lms/courses");
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/login$/);
  });

  // POSITIVE CONTROL for the whole file. If the harness silently dropped the
  // cookie, or SESSION_SECRET diverged between the test and the middleware,
  // every "redirects to /login" assertion above and below would pass while
  // proving nothing. This test must SUCCEED.
  it("passes through an admin request with a valid signed session cookie", async () => {
    const token = await signValidSession();
    const req = makeRequest(
      "http://localhost:3000/admin/lms/courses",
      `session=${token}`
    );
    const res = await middleware(req);
    // NextResponse.next() returns 200 with the x-middleware-next header.
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects an invalid/expired session token to /login", async () => {
    const req = makeRequest(
      "http://localhost:3000/admin/lms/courses",
      "session=not-a-real-jwt"
    );
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/login$/);
  });

  it("redirects an authenticated user away from /login (auth route)", async () => {
    const token = await signValidSession();
    const req = makeRequest("http://localhost:3000/login", `session=${token}`);
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/admin$/);
  });
});

describe("middleware — cross-surface escalation guard (backoffice half)", () => {
  it("redirects /admin/lms/courses to /login when only a learner-style session-learner cookie is present (inverse cross-surface guard)", async () => {
    const learnerToken = await signLearnerStyleSession();
    const req = makeRequest(
      "http://localhost:3000/admin/lms/courses",
      `session-learner=${learnerToken}`
    );
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/login$/);
  });

  it("does not honour a learner-style token presented under the ADMIN cookie name either", async () => {
    // The boundary must rest on the SIGNATURE, not merely on the cookie name.
    // Renaming the cookie must not buy access.
    const learnerToken = await signLearnerStyleSession();
    const req = makeRequest(
      "http://localhost:3000/admin/lms/courses",
      `session=${learnerToken}`
    );
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/login$/);
  });

  it("never parses the learner cookie: a valid session-learner does not bounce /login either", async () => {
    // /login is an auth route: an AUTHENTICATED visitor is bounced to /admin.
    // A learner cookie must leave the visitor anonymous here, so the login form
    // still renders. If this ever 307s, the learner surface has leaked in.
    const learnerToken = await signLearnerStyleSession();
    const res = await middleware(
      makeRequest("http://localhost:3000/login", `session-learner=${learnerToken}`)
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("middleware — dropped and absent surfaces", () => {
  it("has no learner branch: /cursos/<slug>/player is never redirected to learner signin", async () => {
    // Structural assertion of the auth separation. This host serves no
    // /cursos/*; the learner gate lives in apps/academia. Anonymous request
    // falls through (to a 404) rather than redirecting.
    const res = await middleware(
      makeRequest("http://localhost:3000/cursos/intro-to-x/player")
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("does NOT gate /cursos/mis-cursos (dead matcher entry not carried over)", async () => {
    // apps/legacy's learnerProtectedRoutes = ['/cursos/mis-cursos'] gated a page
    // that never existed. It is carried into NEITHER new app; the mirror of this
    // assertion is in apps/academia's suite.
    const res = await middleware(
      makeRequest("http://localhost:3000/cursos/mis-cursos")
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("declares no LEARNER_JWT_SECRET in this workspace's test environment", () => {
    // The distinct-secrets-per-surface boundary is what the guard rests on.
    // If this app ever gains LEARNER_JWT_SECRET, the mirror-half arrangement
    // documented in tests/unit/features/auth/session.test.ts is void and the
    // guard must be re-derived rather than quietly re-pointed at the env.
    expect(process.env.LEARNER_JWT_SECRET).toBeUndefined();
  });
});

describe("config.matcher — the gate that decides whether any of the above runs", () => {
  // Next.js compiles config.matcher through path-to-regexp; the escaping bug
  // this guards against happens earlier, at JS string level, so testing the
  // literal as a regexp source reproduces it faithfully. Verified against the
  // real compiled regexp in .next/server/middleware-manifest.json.
  const matcherRegexes = config.matcher.map((m) => new RegExp(`^${m}$`));
  const matches = (path: string): boolean =>
    matcherRegexes.some((re) => re.test(path));

  it("selects the admin routes the branch above protects", () => {
    for (const path of ["/admin", "/admin/lms", "/admin/lms/courses/new"]) {
      expect(matches(path), `${path} must reach the middleware`).toBe(true);
    }
  });

  it("selects the auth routes", () => {
    for (const path of ["/login", "/forgot-password", "/reset-password"]) {
      expect(matches(path), `${path} must reach the middleware`).toBe(true);
    }
  });

  it("excludes api, _next internals and dotted static assets", () => {
    for (const path of [
      "/api/anything",
      "/_next/static/chunk.js",
      "/_next/image",
      "/favicon.ico",
      "/logo.png",
    ]) {
      expect(matches(path), `${path} must NOT reach the middleware`).toBe(false);
    }
  });
});
