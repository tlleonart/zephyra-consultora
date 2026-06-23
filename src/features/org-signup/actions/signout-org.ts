'use server';

import { redirect } from 'next/navigation';
import { clearLearnerSessionCookie } from '@/features/auth-learner/lib/session';

/**
 * Sign the org owner out (clears the shared learner session cookie) and land
 * them on the empresa sign-in entry. Same cookie as the B2C learner session —
 * the org owner IS a learner-session identity with type:"org_admin".
 */
export const signOutOrg = async (): Promise<void> => {
  await clearLearnerSessionCookie();
  redirect('/empresa/registro');
};
