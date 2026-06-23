'use server';

import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { getLearnerSession } from '@/features/auth-learner/lib/session';

export interface ConsentActionResult {
  success: boolean;
  granted?: boolean;
  error?: string;
}

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Learner-side consent toggle (api-contract §D2). The learnerCustomerId +
 * organizationId are derived from the verified session-learner cookie — never a
 * client value. An org_learner always carries organizationId on the session; an
 * individual learner has no org and cannot reach this surface.
 *
 * grant ⇒ grantProgressConsent (org-wide when courseId is omitted, course-scoped
 * when present); revoke ⇒ revokeProgressConsent. The server is the consent
 * authority — the UI re-reads getMyConsentState after the toggle rather than
 * trusting a local flag.
 */
async function toggleConsent(
  intent: 'grant' | 'revoke',
  courseId?: Id<'lmsCourses'>
): Promise<ConsentActionResult> {
  const session = await getLearnerSession();
  if (!session || !session.organizationId) {
    return { success: false, error: 'Iniciá sesión con tu cuenta de equipo.' };
  }

  try {
    const fn =
      intent === 'grant'
        ? api.lms.consent.grantProgressConsent
        : api.lms.consent.revokeProgressConsent;
    const result = await convex.mutation(fn, {
      learnerCustomerId: session.learnerId,
      organizationId: session.organizationId as Id<'lmsOrganizations'>,
      courseId,
    });
    return { success: true, granted: result.granted };
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message.replace(/^\[.*?\]\s*/, '').replace(/^.*?Error:\s*/, '')
        : 'No pudimos actualizar tu preferencia. Intentá de nuevo.';
    return { success: false, error: message };
  }
}

export async function grantProgressConsent(
  courseId?: Id<'lmsCourses'>
): Promise<ConsentActionResult> {
  return toggleConsent('grant', courseId);
}

export async function revokeProgressConsent(
  courseId?: Id<'lmsCourses'>
): Promise<ConsentActionResult> {
  return toggleConsent('revoke', courseId);
}
