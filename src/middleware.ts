import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const secretKey = new TextEncoder().encode(process.env.SESSION_SECRET || 'fallback-secret-for-development-only');

// Distinct signing key from SESSION_SECRET. Learner cookies cannot validate
// against the admin verify path and vice-versa — cross-surface escalation
// guard rests on this boundary plus the distinct cookie name (PDD §7.5,
// SDD §6 SC #3). Edge runtime cannot import from
// src/features/auth-learner/lib/session.ts (Next.js bundler constraint on
// server-only helpers), so the verify logic is inlined here.
// MUST match the dev fallback in features/auth-learner/lib/session.ts. When
// LEARNER_JWT_SECRET is unset (local dev), the session is signed with
// 'fallback-learner-secret-for-development-only'; a divergent fallback here
// silently fails verification and bounces a freshly-minted learner (e.g. a
// just-claimed org_learner) to sign-in. Production sets LEARNER_JWT_SECRET, so
// this only affects dev parity — but the divergence is a real local-dev bug.
const learnerSecretKey = new TextEncoder().encode(
  process.env.LEARNER_JWT_SECRET || 'fallback-learner-secret-for-development-only'
);

const protectedRoutes = ['/admin'];
const authRoutes = ['/login', '/forgot-password', '/reset-password'];

const learnerProtectedRoutes = ['/cursos/mis-cursos'];
// /cursos/<slug>/player and any nested sub-path (e.g. /player/scorm-frame).
// /cursos, /cursos/<slug>, and /cursos/auth/* MUST remain PUBLIC — catalog
// and learner sign-in entry points cannot be gated by the very session they
// mint.
const learnerProtectedPatterns: RegExp[] = [/^\/cursos\/[^/]+\/player(\/|$)/];
const learnerAuthRoutes = [
  '/cursos/auth/signup',
  '/cursos/auth/signin',
  '/cursos/auth/verify',
  '/cursos/auth/set-password',
];

const verifyLearnerSessionInMiddleware = async (token: string): Promise<boolean> => {
  try {
    await jwtVerify(token, learnerSecretKey);
    return true;
  } catch {
    return false;
  }
};

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Admin branch — unchanged from pre-C04. Uses 'session' cookie + SESSION_SECRET.
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

  // Learner branch — independent. Uses 'session-learner' cookie + LEARNER_JWT_SECRET.
  // An admin 'session' cookie is intentionally insufficient to grant access to
  // learner-protected routes; admins who want to test the player must create
  // a learner account (Sprint 1 locked behavior, cross-surface guard).
  const isLearnerProtectedRoute =
    learnerProtectedRoutes.some(route => path.startsWith(route)) ||
    learnerProtectedPatterns.some(pattern => pattern.test(path));
  const isLearnerAuthRoute = learnerAuthRoutes.some(route => path.startsWith(route));

  const learnerCookie = request.cookies.get('session-learner')?.value;
  let isLearnerAuthenticated = false;
  if (learnerCookie) {
    isLearnerAuthenticated = await verifyLearnerSessionInMiddleware(learnerCookie);
  }

  if (isLearnerProtectedRoute && !isLearnerAuthenticated) {
    const signinUrl = new URL('/cursos/auth/signin', request.url);
    signinUrl.searchParams.set('returnTo', path);
    return NextResponse.redirect(signinUrl);
  }

  if (isLearnerAuthRoute && isLearnerAuthenticated) {
    return NextResponse.redirect(new URL('/cursos', request.url));
  }

  return NextResponse.next();
}

// Matcher unchanged: the existing pattern already catches /admin/* and
// /cursos/* while excluding api/static. No update needed for C04 — the
// learner branches piggy-back on the same request surface.
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
