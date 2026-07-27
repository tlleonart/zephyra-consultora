import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { Id } from '../../../../convex/_generated/dataModel';

// Fail-closed in production: a missing SESSION_SECRET in a prod deploy must NOT
// silently fall back to a source-controlled dev key — that would let anyone
// forge an admin session. We throw when the secret is needed (first sign/verify)
// in production, mirroring the LAZY MAGIC_LINK_HMAC_KEY discipline in
// convex/model/passwords.ts (getHmacKey). Resolution is LAZY (not at module
// load) so `next build`'s page-data collection — which runs with
// NODE_ENV=production but no runtime env — does not crash at import time; the
// guard fires on the first actual session operation in a running prod deploy.
// The dev fallback is kept ONLY for non-production (local dev + tests).
let cachedSecretKey: Uint8Array | null = null;
const getSecretKey = (): Uint8Array => {
  if (cachedSecretKey) return cachedSecretKey;
  const fromEnv = process.env.SESSION_SECRET;
  if (!fromEnv && process.env.NODE_ENV === 'production') {
    throw new Error(
      'SESSION_SECRET is not set in environment; admin session signing requires it in production.'
    );
  }
  cachedSecretKey = new TextEncoder().encode(
    fromEnv || 'fallback-secret-for-development-only'
  );
  return cachedSecretKey;
};

const SESSION_COOKIE = 'session';
const SESSION_DURATION = 30 * 60; // 30 minutes in seconds

export interface SessionPayload {
  userId: Id<'adminUsers'>;
  email: string;
  name: string;
  role: 'superadmin' | 'admin';
  exp: number;
}

export const createSession = async (user: {
  _id: Id<'adminUsers'>;
  email: string;
  name: string;
  role: 'superadmin' | 'admin';
}): Promise<string> => {
  const token = await new SignJWT({
    userId: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getSecretKey());

  return token;
};

export const verifySession = async (
  token: string
): Promise<SessionPayload | null> => {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
};

export const getSession = async (): Promise<SessionPayload | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
};

export const setSessionCookie = async (token: string): Promise<void> => {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION,
    path: '/',
  });
};

export const clearSessionCookie = async (): Promise<void> => {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
};
