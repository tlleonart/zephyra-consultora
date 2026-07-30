'use server';

import { ConvexHttpClient } from 'convex/browser';
import { api } from '@zephyra/convex/_generated/api';
import {
  createLearnerSession,
  setLearnerSessionCookie,
} from '../lib/session';
import { Id } from '@zephyra/convex/_generated/dataModel';

interface LearnerCustomer {
  _id: Id<'lmsCustomers'>;
  email: string;
  type: 'individual' | 'org_admin' | 'org_learner';
  activatedAt?: number;
  organizationId?: string;
}

export interface SigninPasswordResult {
  success: boolean;
  error?: string;
}

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export const signInLearnerWithPassword = async (
  email: string,
  password: string
): Promise<SigninPasswordResult> => {
  try {
    const result = await convex.mutation(
      api.lms.auth.signInLearnerWithPassword,
      { email, password }
    );

    const customer = result.customer as unknown as LearnerCustomer;
    const token = await createLearnerSession({
      _id: customer._id,
      email: customer.email,
      type: customer.type,
      organizationId: customer.organizationId,
    });
    await setLearnerSessionCookie(token);

    return { success: true };
  } catch {
    // Uniform anti-enumeration message regardless of failure mode (no row,
    // soft-deleted, no password set, wrong password) — matches the backend
    // contract in convex/lms/auth.ts.
    return { success: false, error: 'credenciales inválidas' };
  }
};
