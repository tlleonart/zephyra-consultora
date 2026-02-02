import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { Id } from '../../../../convex/_generated/dataModel';

const secretKey = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'fallback-secret-for-development-only'
);

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
    .sign(secretKey);

  return token;
};

export const verifySession = async (
  token: string
): Promise<SessionPayload | null> => {
  try {
    const { payload } = await jwtVerify(token, secretKey);
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
