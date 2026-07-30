import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { Id } from '@zephyra/convex/_generated/dataModel';

// Distinct signing key from the admin SESSION_SECRET. A cookie minted with
// LEARNER_JWT_SECRET cannot validate against the admin verify path (and
// vice-versa) — the cross-surface escalation guard rests on this boundary
// PLUS the distinct cookie name (PDD §7.5, SDD §6 SC #3).
//
// Fail-closed in production: a missing LEARNER_JWT_SECRET in a prod deploy must
// NOT silently fall back to a source-controlled dev key — that would let anyone
// forge an org_admin learner session (trusted by requireOrgOwner via
// callerCustomerId). We throw when the secret is needed (first sign/verify) in
// production, mirroring the LAZY MAGIC_LINK_HMAC_KEY discipline in
// convex/model/passwords.ts (getHmacKey). Resolution is LAZY (not at module
// load) so `next build`'s page-data collection — which runs with
// NODE_ENV=production but no runtime env — does not crash at import time; the
// guard fires on the first actual session operation in a running prod deploy.
// The dev fallback is kept ONLY for non-production (local dev + tests).
let cachedSecretKey: Uint8Array | null = null;
const getSecretKey = (): Uint8Array => {
  if (cachedSecretKey) return cachedSecretKey;
  const fromEnv = process.env.LEARNER_JWT_SECRET;
  if (!fromEnv && process.env.NODE_ENV === 'production') {
    throw new Error(
      'LEARNER_JWT_SECRET is not set in environment; learner session signing requires it in production.'
    );
  }
  cachedSecretKey = new TextEncoder().encode(
    fromEnv || 'fallback-learner-secret-for-development-only'
  );
  return cachedSecretKey;
};

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
    .sign(getSecretKey());

  return token;
};

export const verifyLearnerSession = async (
  token: string
): Promise<LearnerSessionPayload | null> => {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
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
