import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// ADMIN BRANCH ONLY. apps/backoffice is the staff surface; the learner branch
// that lived alongside this one in apps/legacy/src/middleware.ts is deliberately
// NOT carried over (domain-boundaries v1.1 §3/§4). There is no SSO between the
// apps: an admin 'session' cookie grants nothing learner-side, and a learner
// 'session-learner' cookie is not even parsed here — LEARNER_JWT_SECRET must
// never appear in this workspace, because distinct secrets per surface are the
// anti-escalation boundary. The dead '/cursos/mis-cursos' entry from the legacy
// learnerProtectedRoutes list is likewise not carried in (the route never
// existed; it moves nowhere).
const secretKey = new TextEncoder().encode(process.env.SESSION_SECRET || 'fallback-secret-for-development-only');

const protectedRoutes = ['/admin'];
const authRoutes = ['/login', '/forgot-password', '/reset-password'];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route));
  const isAuthRoute = authRoutes.some(route => path.startsWith(route));

  const sessionCookie = request.cookies.get('session')?.value;

  let isAuthenticated = false;
  if (sessionCookie) {
    try {
      await jwtVerify(sessionCookie, secretKey);
      isAuthenticated = true;
    } catch {
      // Invalid or expired token
    }
  }

  if (isProtectedRoute && !isAuthenticated) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return NextResponse.next();
}

// Unchanged from apps/legacy: the pattern already catches /admin/* and the
// three (auth) routes while excluding api/static. This app serves no /cursos/*,
// so no learner pattern is needed.
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\..*).*)'],
};
