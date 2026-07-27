/**
 * Unit tests for middleware.ts — admin AND learner protected-route branches.
 *
 * C04 landed the learner branch ('session-learner' cookie + LEARNER_JWT_SECRET).
 * Both branches must remain independent: admin cookies do NOT grant learner
 * routes (and vice versa). The cross-surface guard tests below enforce this
 * structurally.
 */
import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { middleware } from "../../src/middleware";

const ADMIN_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "test-session-secret-not-for-production-use"
);

const LEARNER_SECRET = new TextEncoder().encode(
  process.env.LEARNER_JWT_SECRET ??
    "test-learner-jwt-secret-not-for-production-use"
);

const signValidSession = async (): Promise<string> => {
  return await new SignJWT({ sub: "user-1", role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(ADMIN_SECRET);
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

describe("middleware — admin protected route branch", () => {
  it("redirects an anonymous request to /admin/lms/... to /login", async () => {
    const req = makeRequest("http://localhost:3000/admin/lms/courses");
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/login$/);
  });

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

  it("redirects /cursos/<slug>/player to learner signin when only an admin session cookie is present (cross-surface guard)", async () => {
    const adminToken = await signValidSession();
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

  it("redirects /admin/lms/courses to /login when only a session-learner cookie is present (inverse cross-surface guard)", async () => {
    const learnerToken = await signValidLearnerSession();
    const req = makeRequest(
      "http://localhost:3000/admin/lms/courses",
      `session-learner=${learnerToken}`
    );
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/login$/);
  });
});
