'use server';

import { ConvexHttpClient } from 'convex/browser';
import { api } from '@zephyra/convex/_generated/api';
import { Id } from '@zephyra/convex/_generated/dataModel';
import {
  createLearnerSession,
  setLearnerSessionCookie,
} from '@/features/auth-learner/lib/session';

export interface ClaimSeatResult {
  success: boolean;
  alreadyClaimed?: boolean;
  /** Slug of the enrolled course so the landing page can open the player. */
  courseSlug?: string;
  error?: string;
}

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * E4 — claim a seat from the invite landing (api-contract §C2).
 *
 * AUTH: the token IS the proof of email control — there is no owner gate here
 * (the claimer is the invited employee). claimSeat resolves or CREATES the
 * org_learner lmsCustomers row on first touch, picks an available seat → claimed,
 * and creates ONE active enrollment. We then mint the SAME learner-session cookie
 * the B2C flow uses (type:"org_learner", carrying organizationId) so the claimed
 * employee is routed straight into the player UX — gated on getMyEnrollment
 * exactly like a B2C learner.
 *
 * REPLAY (idempotent): a second claim with the SAME claimRequestId returns the
 * existing seat + enrollment with alreadyClaimed:true — no new seat/enrollment.
 * We still (re)mint the session so a flaky landing reload lands the learner in.
 *
 * OVER-CLAIM / burned token / dedup: the mutation throws a human-readable
 * Spanish error which we surface on the landing page.
 */
export const claimSeat = async (args: {
  token: string;
  claimRequestId: string;
  organizationId: Id<'lmsOrganizations'>;
  seatPackId: Id<'lmsSeatPacks'>;
  employeeEmail: string;
}): Promise<ClaimSeatResult> => {
  const email = args.employeeEmail.trim();
  if (email.length === 0) {
    return { success: false, error: 'Ingresá tu email para activar el acceso.' };
  }

  let claim: {
    seatId: Id<'lmsSeats'>;
    enrollmentId: Id<'lmsEnrollments'>;
    learnerId: Id<'lmsCustomers'>;
    alreadyClaimed: boolean;
  };
  try {
    claim = await convex.mutation(api.lms.seats.claimSeat, {
      token: args.token,
      claimRequestId: args.claimRequestId,
      organizationId: args.organizationId,
      seatPackId: args.seatPackId,
      employeeEmail: email,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message.replace(/^\[.*?\]\s*/, '').replace(/^.*?Error:\s*/, '')
        : 'No pudimos activar tu acceso. Revisá el link e intentá de nuevo.';
    return { success: false, error: message };
  }

  // Mint the org_learner session so the claimed employee is signed in and the
  // player gate (getMyEnrollment) passes on the redirect.
  const sessionToken = await createLearnerSession({
    _id: claim.learnerId,
    email,
    type: 'org_learner',
    organizationId: args.organizationId,
  });
  await setLearnerSessionCookie(sessionToken);

  // Resolve the enrolled course's slug so the landing routes into the player.
  // The pack's courseId is read from the public seat-packs query (owner-gated)
  // is NOT available to the learner; instead we resolve the slug from the
  // published list by matching the enrollment's course — read via the learner's
  // own enrollment list (self-scoped).
  let courseSlug: string | undefined;
  try {
    const enrollments = await convex.query(api.lms.enrollments.listMyEnrollments, {
      learnerId: claim.learnerId,
    });
    const courses = await convex.query(api.lms.courses.listPublished, {});
    // Prefer the enrollment created by THIS claim; fall back to any active one.
    const active = enrollments.find((e) => e._id === claim.enrollmentId) ?? enrollments[0];
    if (active) {
      const course = courses.find((c) => c._id === active.courseId);
      courseSlug = course?.slug;
    }
  } catch {
    // Non-fatal: the landing falls back to the catalog if the slug is missing.
  }

  return {
    success: true,
    alreadyClaimed: claim.alreadyClaimed,
    courseSlug,
  };
};
