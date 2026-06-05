/**
 * Unit tests for middleware.ts — admin protected-route branch only.
 *
 * The learner-cookie branch ("session-learner") is NOT yet implemented in
 * middleware.ts; that landing is C-spawn territory (Sprint 1 C-tasks).
 * When it lands, add a parallel suite here and the C-spawn report can cite
 * this test file as the regression seam.
 */
import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { middleware } from "../../middleware";

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "test-session-secret-not-for-production-use"
);

const signValidSession = async (): Promise<string> => {
  return await new SignJWT({ sub: "user-1", role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(SECRET);
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
