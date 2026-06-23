'use server';

import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { getLearnerSession } from '@/features/auth-learner/lib/session';

export interface CreatePackCheckoutResult {
  success: boolean;
  redirectUrl?: string;
  orderId?: string;
  error?: string;
}

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Open a MercadoPago checkout for a seat pack (api-contract §3).
 *
 * AUTH BOUNDARY: the `session-learner` cookie is validated here and the
 * callerCustomerId is derived from the verified session — never a client value.
 * The Convex action re-asserts requireOrgOwner (the caller must own the target
 * org). We send ONLY seatCount; NO price/discount/total — the server is the
 * sole pricing authority and recomputes the total before snapshotting the
 * order. Returns the Checkout Pro redirectUrl + orderId; the client drives the
 * off-site navigation (same pattern as the B2C createCheckout action).
 */
export const createPackCheckout = async (args: {
  organizationId: Id<'lmsOrganizations'>;
  courseId: Id<'lmsCourses'>;
  seatCount: number;
}): Promise<CreatePackCheckoutResult> => {
  const session = await getLearnerSession();
  if (!session) {
    return { success: false, error: 'Iniciá sesión para comprar' };
  }

  try {
    const { redirectUrl, orderId } = await convex.action(
      api.lms.payment.checkout.createPackCheckout,
      {
        callerCustomerId: session.learnerId,
        organizationId: args.organizationId,
        courseId: args.courseId,
        seatCount: args.seatCount,
      }
    );
    return { success: true, redirectUrl, orderId };
  } catch (error) {
    // The Convex action throws human-readable Spanish errors (50+ reject,
    // invalid seatCount, not purchasable, no autorizado). Surface the message
    // inline; fall back to a generic line for an unexpected shape.
    const message =
      error instanceof Error && error.message
        ? error.message.replace(/^\[.*?\]\s*/, '').replace(/^.*?Error:\s*/, '')
        : 'No pudimos iniciar la compra. Intentá de nuevo.';
    return { success: false, error: message };
  }
};
