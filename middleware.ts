import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const secretKey = new TextEncoder().encode(process.env.SESSION_SECRET || 'fallback-secret-for-development-only');

const protectedRoutes = ['/admin'];
const authRoutes = ['/login', '/forgot-password', '/reset-password'];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Check if route needs protection
  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route));
  const isAuthRoute = authRoutes.some(route => path.startsWith(route));

  // Get session cookie
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

  // Redirect unauthenticated users from protected routes
  if (isProtectedRoute && !isAuthenticated) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Redirect authenticated users from auth routes
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
