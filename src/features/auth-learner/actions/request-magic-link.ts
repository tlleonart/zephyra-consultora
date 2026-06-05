'use server';

import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../convex/_generated/api';
import { sendLearnerEmail } from '@/lib/mailer/learner';
import LearnerMagicLink from '@/emails/LearnerMagicLink';

type Purpose =
  | 'learner_activation'
  | 'learner_signin'
  | 'learner_recovery';

export interface RequestMagicLinkResult {
  success: boolean;
  error?: string;
  alreadyActivated?: boolean;
}

const subjectByPurpose: Record<Purpose, string> = {
  learner_activation: 'Activá tu cuenta de Zephyra',
  learner_signin: 'Tu link de ingreso a Zephyra',
  learner_recovery: 'Recuperá tu acceso a Zephyra',
};

const ttlMinutesByPurpose: Record<Purpose, number> = {
  learner_activation: 30,
  learner_signin: 15,
  learner_recovery: 15,
};

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export const requestMagicLink = async (
  email: string,
  purpose: Purpose,
  returnTo?: string
): Promise<RequestMagicLinkResult> => {
  try {
    const result = await convex.mutation(api.lms.auth.requestMagicLink, {
      email,
      purpose,
    });

    if (result.alreadyActivated) {
      return { success: true, alreadyActivated: true };
    }

    if (result.rawToken) {
      // returnTo is embedded so /cursos/auth/verify can land the learner on
      // the originally-intended path after consumeMagicLink succeeds. Kept
      // optional so existing callers (signup, recovery) need no changes.
      const returnToParam = returnTo
        ? `&returnTo=${encodeURIComponent(returnTo)}`
        : '';
      const magicLinkUrl =
        `${process.env.NEXT_PUBLIC_APP_URL}/cursos/auth/verify` +
        `?token=${result.rawToken}&purpose=${purpose}${returnToParam}`;
      const expiresInMinutes = ttlMinutesByPurpose[purpose];

      await sendLearnerEmail({
        to: email,
        subject: subjectByPurpose[purpose],
        magicLinkUrl,
        react: LearnerMagicLink({
          magicLinkUrl,
          purpose,
          expiresInMinutes,
        }),
      });
    }

    return { success: true, alreadyActivated: false };
  } catch (error) {
    // Anti-enumeration: collapse every backend failure (unknown email,
    // soft-deleted, mailer error) into the same opaque success shape so
    // an attacker cannot probe which addresses exist as learners. Mirrors
    // src/features/auth/actions/password-reset.ts.
    console.error('magic-link error:', error);
    return { success: true };
  }
};
