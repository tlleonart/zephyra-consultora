'use server';

import { ConvexHttpClient } from 'convex/browser';
import { api } from '@zephyra/convex/_generated/api';
import { Id } from '@zephyra/convex/_generated/dataModel';
import { getLearnerSession } from '@/features/auth-learner/lib/session';

export interface CreateCheckoutResult {
  success: boolean;
  redirectUrl?: string;
  error?: string;
}

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Server action — open a MercadoPago checkout for a course.
 *
 * AUTH BOUNDARY: this is where the `session-learner` cookie is validated. We
 * derive the learnerId from the verified session and pass it to the Convex
 * `createCheckout` action (which trusts the boundary — see its header). A
 * caller without a valid session is bounced to sign-in; the cookie is the only
 * source of learner identity, never a client-supplied id.
 *
 * Returns the Checkout Pro `redirectUrl` to the client form, which performs the
 * browser navigation. We do NOT redirect() server-side: a redirect to an
 * external (MercadoPago) origin from a server action is brittle, and the client
 * needs to drive `window.location` to the off-site checkout.
 */
export const createCheckout = async (
  courseId: Id<'lmsCourses'>
): Promise<CreateCheckoutResult> => {
  const session = await getLearnerSession();
  if (!session) {
    return { success: false, error: 'Iniciá sesión para comprar' };
  }

  try {
    const { redirectUrl } = await convex.action(
      api.lms.payment.checkout.createCheckout,
      { learnerId: session.learnerId, courseId }
    );
    return { success: true, redirectUrl };
  } catch (error) {
    // The Convex action throws human-readable Spanish messages (already
    // enrolled, course not purchasable, learner not found). Surface a generic
    // fallback if the shape is unexpected; never leak provider internals.
    const message =
      error instanceof Error && error.message
        ? error.message.replace(/^\[.*?\]\s*/, '')
        : 'No pudimos iniciar la compra. Intentá de nuevo.';
    return { success: false, error: message };
  }
};
