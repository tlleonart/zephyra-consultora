import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { Id } from '../../../../convex/_generated/dataModel';

// Distinct signing key from the admin SESSION_SECRET. A cookie minted with
// LEARNER_JWT_SECRET cannot validate against the admin verify path (and
// vice-versa) — the cross-surface escalation guard rests on this boundary
// PLUS the distinct cookie name (PDD §7.5, SDD §6 SC #3).
const secretKey = new TextEncoder().encode(
  process.env.LEARNER_JWT_SECRET || 'fallback-learner-secret-for-development-only'
);

const SESSION_COOKIE = 'session-learner';
// 7 days. Learners expect long-lived sessions (browse courses, come back next
// day), whereas admins are time-boxed at 30 min for blast-radius reasons.
const SESSION_DURATION = 7 * 24 * 60 * 60;

export interface LearnerSessionPayload {
  learnerId: Id<'lmsCustomers'>;
  email: string;
  type: 'individual' | 'org_admin' | 'org_learner';
  organizationId?: string;
  exp: number;
}

export const createLearnerSession = async (learner: {
  _id: Id<'lmsCustomers'>;
  email: string;
  type: 'individual' | 'org_admin' | 'org_learner';
  organizationId?: string;
}): Promise<string> => {
  const token = await new SignJWT({
    learnerId: learner._id,
    email: learner.email,
    type: learner.type,
    organizationId: learner.organizationId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(secretKey);

  return token;
};

export const verifyLearnerSession = async (
  token: string
): Promise<LearnerSessionPayload | null> => {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload as unknown as LearnerSessionPayload;
  } catch {
    return null;
  }
};

export const getLearnerSession = async (): Promise<LearnerSessionPayload | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyLearnerSession(token);
};

export const setLearnerSessionCookie = async (token: string): Promise<void> => {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION,
    path: '/',
  });
};

export const clearLearnerSessionCookie = async (): Promise<void> => {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
};
