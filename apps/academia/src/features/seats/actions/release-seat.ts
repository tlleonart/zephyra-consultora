'use server';

import { ConvexHttpClient } from 'convex/browser';
import { api } from '@zephyra/convex/_generated/api';
import { Id } from '@zephyra/convex/_generated/dataModel';
import { getLearnerSession } from '@/features/auth-learner/lib/session';

export interface ReleaseSeatResult {
  success: boolean;
  error?: string;
}

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * E5 — release a claimed seat (marcar baja, api-contract §C3).
 *
 * AUTH BOUNDARY: the owner id is the verified session value; the Convex mutation
 * re-asserts requireOrgOwner. The seat returns to the pool (claimed → released,
 * availableSeats++ / claimedSeats--) and the enrollment is ENDED.
 *
 * RELEASE BLOCKED IF STARTED: the mutation throws "no se puede liberar un asiento
 * de un learner que ya comenzó el curso" when the learner has any engagement.
 * The dashboard greys out the action for started learners; this action surfaces
 * the rejection message clearly if it slips through.
 */
export const releaseSeat = async (args: {
  organizationId: Id<'lmsOrganizations'>;
  seatId: Id<'lmsSeats'>;
}): Promise<ReleaseSeatResult> => {
  const session = await getLearnerSession();
  if (!session || session.type !== 'org_admin') {
    return { success: false, error: 'Iniciá sesión como administrador de la empresa.' };
  }

  try {
    await convex.mutation(api.lms.seats.releaseSeat, {
      callerCustomerId: session.learnerId,
      organizationId: args.organizationId,
      seatId: args.seatId,
    });
    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message.replace(/^\[.*?\]\s*/, '').replace(/^.*?Error:\s*/, '')
        : 'No pudimos dar de baja el lugar. Intentá de nuevo.';
    return { success: false, error: message };
  }
};
