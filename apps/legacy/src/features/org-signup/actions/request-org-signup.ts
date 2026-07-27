'use server';

import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../convex/_generated/api';
import { sendLearnerEmail } from '@/lib/mailer/learner';
import LearnerMagicLink from '@/emails/LearnerMagicLink';

export interface RequestOrgSignupResult {
  success: boolean;
  alreadyActivated?: boolean;
}

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Step 1 of the two-step org sign-up (api-contract §1). We REUSE the existing
 * learner magic-link (purpose: "learner_activation") to prove email control —
 * org creation is gated behind the same proof as a B2C activation. The only
 * difference vs. the B2C signup action is the magic-link `returnTo`: it lands
 * the verified owner on the empresa create-org step (carrying the org name +
 * admin name they typed) instead of the learner set-password page.
 *
 * Anti-enumeration: any backend/mailer failure collapses to the same opaque
 * success shape (mirrors features/auth-learner/actions/request-magic-link.ts).
 */
export const requestOrgSignup = async (
  email: string,
  orgName: string,
  adminName: string,
  taxId?: string
): Promise<RequestOrgSignupResult> => {
  try {
    const result = await convex.mutation(api.lms.auth.requestMagicLink, {
      email,
      purpose: 'learner_activation',
    });

    if (result.alreadyActivated) {
      return { success: true, alreadyActivated: true };
    }

    if (result.rawToken) {
      // The link lands directly on the create-org step, carrying the token +
      // the org details the owner typed. The values are NOT trusted as identity
      // — only the consumed magic link proves the email, and createOrganization
      // re-asserts the activated-customer gate before stamping the org.
      const magicLinkUrl =
        `${process.env.NEXT_PUBLIC_APP_URL}/empresa/registro/crear` +
        `?token=${result.rawToken}` +
        `&orgName=${encodeURIComponent(orgName)}` +
        `&adminName=${encodeURIComponent(adminName)}` +
        (taxId ? `&taxId=${encodeURIComponent(taxId)}` : '');

      await sendLearnerEmail({
        to: email,
        subject: 'Activá tu cuenta de empresa en Zephyra',
        magicLinkUrl,
        react: LearnerMagicLink({
          magicLinkUrl,
          purpose: 'learner_activation',
          expiresInMinutes: 30,
        }),
      });
    }

    return { success: true, alreadyActivated: false };
  } catch (error) {
    console.error('org-signup magic-link error:', error);
    return { success: true };
  }
};
