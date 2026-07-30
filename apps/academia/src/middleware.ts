import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// LEARNER BRANCH ONLY. This app serves EXTERNAL users (learners B2C, Org Admins
// B2B, org learners). The admin branch — 'session' cookie + SESSION_SECRET,
// /admin and /login|/forgot-password|/reset-password — lives in
// apps/backoffice/src/middleware.ts and MUST NOT appear here. There is no
// SESSION_SECRET in this app's env and no admin verify path in this bundle, so
// an admin cookie grants nothing on this host by construction (boundaries §4,
// PDD §7.5, SDD §6 SC #3).
//
// Distinct signing key from SESSION_SECRET. Learner cookies cannot validate
// against the admin verify path and vice-versa — the cross-surface escalation
// guard rests on this boundary plus the distinct cookie name. Edge runtime
// cannot import from src/features/auth-learner/lib/session.ts (Next.js bundler
// constraint on server-only helpers — that module imports `next/headers`), so
// the verify logic is INLINED here. Do not "clean this up" into an import.
// MUST match the dev fallback in features/auth-learner/lib/session.ts. When
// LEARNER_JWT_SECRET is unset (local dev), the session is signed with
// 'fallback-learner-secret-for-development-only'; a divergent fallback here
// silently fails verification and bounces a freshly-minted learner (e.g. a
// just-claimed org_learner) to sign-in. Production sets LEARNER_JWT_SECRET, so
// this only affects dev parity — but the divergence is a real local-dev bug.
const learnerSecretKey = new TextEncoder().encode(
  process.env.LEARNER_JWT_SECRET || 'fallback-learner-secret-for-development-only'
);

// /cursos/<slug>/player and any nested sub-path (e.g. /player/scorm-frame).
// /cursos, /cursos/<slug>, and /cursos/auth/* MUST remain PUBLIC — catalog
// and learner sign-in entry points cannot be gated by the very session they
// mint.
//
// The pattern stays narrowly scoped to /cursos/<slug>/player rather than
// widening to /^\/[^/]+\/player/: the /cursos prefix is KEPT on this host
// (boundaries v1.1 §3.1 D1), so there is no reason to match an arbitrary first
// segment. apps/legacy's `learnerProtectedRoutes = ['/cursos/mis-cursos']` is
// deliberately NOT carried over — that page never existed, so the entry gated
// a 404 (boundaries §3, "Resolved ambiguities"). A learner dashboard will be
// (re)introduced deliberately with its own matcher entry.
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

  // Learner branch. Uses 'session-learner' cookie + LEARNER_JWT_SECRET.
  // An admin 'session' cookie is intentionally insufficient to grant access to
  // learner-protected routes; admins who want to test the player must create
  // a learner account (Sprint 1 locked behavior, cross-surface guard).
  const isLearnerProtectedRoute = learnerProtectedPatterns.some(pattern => pattern.test(path));
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

// Matcher unchanged from apps/legacy: the pattern already catches /cursos/* and
// /empresa/* while excluding api/static. Critically it excludes `api`, which is
// why /api/lms/asset/[slug]/[...path] (the SCORM proxy) is NOT intercepted —
// the CAMPUS iframe fetches assets without going through this middleware. Any
// future auth gate on the proxy (T-fe-008b) therefore has to live in the route
// handler itself, not here.
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
