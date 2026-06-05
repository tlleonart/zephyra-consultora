'use server';

import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../convex/_generated/api';
import {
  createLearnerSession,
  setLearnerSessionCookie,
} from '../lib/session';
import { Id } from '../../../../convex/_generated/dataModel';

type Purpose =
  | 'learner_activation'
  | 'learner_signin'
  | 'learner_recovery';

interface LearnerCustomer {
  _id: Id<'lmsCustomers'>;
  email: string;
  type: 'individual' | 'org_admin' | 'org_learner';
  activatedAt?: number;
  organizationId?: string;
}

export interface ConsumeResult {
  success: boolean;
  error?: string;
  customer?: LearnerCustomer;
  isActivation?: boolean;
}

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export const consumeMagicLink = async (
  rawToken: string,
  purpose: Purpose
): Promise<ConsumeResult> => {
  try {
    const result = await convex.mutation(api.lms.auth.consumeMagicLink, {
      token: rawToken,
      purpose,
    });

    const customer = result.customer as unknown as LearnerCustomer;

    const token = await createLearnerSession({
      _id: customer._id,
      email: customer.email,
      type: customer.type,
      organizationId: customer.organizationId,
    });
    await setLearnerSessionCookie(token);

    return {
      success: true,
      customer,
      isActivation: purpose === 'learner_activation',
    };
  } catch (error) {
    // Convex propagates server-thrown AuthError as `Error` with the original
    // message embedded (e.g. "Uncaught AuthError: link inválido o expirado").
    // Surface the user-facing tail to keep the UI message in Spanish.
    const raw =
      error instanceof Error ? error.message : 'link inválido o expirado';
    const cleaned = raw.replace(/^.*AuthError:\s*/, '').split(/\n|\s+at\s/)[0];
    return { success: false, error: cleaned || 'link inválido o expirado' };
  }
};
