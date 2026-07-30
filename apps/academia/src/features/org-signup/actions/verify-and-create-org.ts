'use server';

import { ConvexHttpClient } from 'convex/browser';
import { api } from '@zephyra/convex/_generated/api';
import {
  createLearnerSession,
  setLearnerSessionCookie,
} from '@/features/auth-learner/lib/session';
import { Id } from '@zephyra/convex/_generated/dataModel';

interface LearnerCustomer {
  _id: Id<'lmsCustomers'>;
  email: string;
  type: 'individual' | 'org_admin' | 'org_learner';
  activatedAt?: number;
  organizationId?: string;
}

export interface VerifyAndCreateOrgResult {
  success: boolean;
  error?: string;
  organizationId?: string;
  alreadyExisted?: boolean;
}

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Step 2 of the org sign-up (api-contract §1): consume the magic link to prove
 * email control (creates/activates the lmsCustomers row + mints the learner
 * session), then createOrganization with that verified ownerCustomerId.
 *
 * The two server-side calls are chained here so the verified customer._id from
 * the consume IS the ownerCustomerId for createOrganization — never a
 * client-supplied id. After the org is created the customer is promoted to
 * type:"org_admin" server-side, so we refresh the session cookie to carry the
 * new type + organizationId (the empresa layout reads them from the session).
 *
 * Idempotent: a re-submit for an owner who already has an org returns the
 * existing org with alreadyExisted:true (createOrganization collapses it).
 */
export const verifyAndCreateOrg = async (
  token: string,
  orgName: string,
  taxId?: string
): Promise<VerifyAndCreateOrgResult> => {
  let customer: LearnerCustomer;
  try {
    const consumeResult = await convex.mutation(api.lms.auth.consumeMagicLink, {
      token,
      purpose: 'learner_activation',
    });
    customer = consumeResult.customer as unknown as LearnerCustomer;
  } catch (error) {
    const raw =
      error instanceof Error ? error.message : 'link inválido o expirado';
    const cleaned = raw.replace(/^.*AuthError:\s*/, '').split(/\n|\s+at\s/)[0];
    return { success: false, error: cleaned || 'link inválido o expirado' };
  }

  try {
    const org = await convex.mutation(api.lms.org.createOrganization, {
      ownerCustomerId: customer._id,
      name: orgName,
      taxId: taxId && taxId.trim().length > 0 ? taxId : undefined,
    });

    // Refresh the session to reflect the org_admin promotion + organizationId so
    // the empresa layout (which reads the session) routes the owner correctly.
    const sessionToken = await createLearnerSession({
      _id: customer._id,
      email: customer.email,
      type: 'org_admin',
      organizationId: org.organizationId,
    });
    await setLearnerSessionCookie(sessionToken);

    return {
      success: true,
      organizationId: org.organizationId,
      alreadyExisted: org.alreadyExisted,
    };
  } catch (error) {
    const raw =
      error instanceof Error
        ? error.message
        : 'No se pudo crear la organización';
    const cleaned = raw.replace(/^.*AuthError:\s*/, '').split(/\n|\s+at\s/)[0];
    return {
      success: false,
      error: cleaned || 'No se pudo crear la organización',
    };
  }
};
