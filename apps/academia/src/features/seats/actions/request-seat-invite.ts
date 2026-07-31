'use server';

import { ConvexHttpClient } from 'convex/browser';
import { api } from '@zephyra/convex/_generated/api';
import { Id } from '@zephyra/convex/_generated/dataModel';
import { getLearnerSession } from '@/features/auth-learner/lib/session';
import { sendLearnerEmail } from '@/lib/mailer/learner';
import SeatInvite from '@/emails/SeatInvite';
import { requireOrigin } from '@zephyra/utils';

export interface RequestSeatInviteResult {
  success: boolean;
  alreadyPending?: boolean;
  error?: string;
}

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const INVITE_TTL_DAYS = 7;

/**
 * E4 — invite an employee to claim a seat (api-contract §C1).
 *
 * AUTH BOUNDARY: the session-learner cookie is validated here; the
 * callerCustomerId is the verified owner id, never a client value. The Convex
 * mutation re-asserts requireOrgOwner (caller owns the org + the pack belongs to
 * it). We send ONLY the seatPackId + email; the backend mints the token.
 *
 * The mutation does NOT send the email — IT returns rawToken + claimRequestId.
 * This action composes the claim URL (the four URL params the landing page +
 * claimSeat re-verify) and sends the SeatInvite template via sendLearnerEmail.
 *
 * IDEMPOTENT RE-INVITE: a second invite for the same email while a pending
 * (unused, unexpired) invite exists returns alreadyPending:true with
 * rawToken:null — we do NOT compose/send a new link (the prior one is live) and
 * surface "ya invitado / link vigente" in the UI.
 */
export const requestSeatInvite = async (args: {
  organizationId: Id<'lmsOrganizations'>;
  seatPackId: Id<'lmsSeatPacks'>;
  courseId: Id<'lmsCourses'>;
  employeeEmail: string;
}): Promise<RequestSeatInviteResult> => {
  const session = await getLearnerSession();
  if (!session || session.type !== 'org_admin') {
    return { success: false, error: 'Iniciá sesión como administrador de la empresa.' };
  }

  const email = args.employeeEmail.trim();
  if (email.length === 0) {
    return { success: false, error: 'Ingresá el email del empleado.' };
  }

  let invite: {
    rawToken: string | null;
    claimRequestId: string | null;
    expiresAt: number;
    alreadyPending: boolean;
  };
  try {
    invite = await convex.mutation(api.lms.seats.requestSeatInvite, {
      callerCustomerId: session.learnerId,
      organizationId: args.organizationId,
      seatPackId: args.seatPackId,
      employeeEmail: email,
    });
  } catch (error) {
    // The mutation throws human-readable Spanish errors (pack full, no
    // autorizado, email obligatorio). Surface the message inline.
    const message =
      error instanceof Error && error.message
        ? error.message.replace(/^\[.*?\]\s*/, '').replace(/^.*?Error:\s*/, '')
        : 'No pudimos enviar la invitación. Intentá de nuevo.';
    return { success: false, error: message };
  }

  // Idempotent re-invite: the prior link is still live; do not re-send.
  if (invite.alreadyPending || !invite.rawToken || !invite.claimRequestId) {
    return { success: true, alreadyPending: true };
  }

  // Resolve the course title (display only) via the public published list — the
  // admin-gated getById is off-limits to this surface.
  let courseTitle = 'tu curso';
  try {
    const courses = await convex.query(api.lms.courses.listPublished, {});
    const match = courses.find((c) => c._id === args.courseId);
    if (match) courseTitle = match.title;
  } catch {
    // Non-fatal: fall back to the generic title in the email.
  }

  // Resolve the org name for the email copy (owner-gated read — the caller IS
  // the owner here, so this is authorized).
  let organizationName = 'tu empresa';
  try {
    const org = await convex.query(api.lms.org.getMyOrganization, {
      callerCustomerId: session.learnerId,
      organizationId: args.organizationId,
    });
    if (org?.name) organizationName = org.name;
  } catch {
    // Non-fatal: fall back to the generic name in the email.
  }

  // Claim URL shape (api-contract §C1): the (org, seatPack) binding lives in the
  // URL, not in the token row, and is re-verified server-side at claim time.
  // Seat invites are an ACADEMIA flow (boundaries §5) and /empresa/invitacion is
  // served by this app alone. The former apex fallback was the worst of the
  // three: /empresa/* is not in the 301 map (boundaries §3.1), so an invite that
  // fell back would 404 for a real invited learner. requireOrigin throws.
  const baseUrl = requireOrigin(
    'NEXT_PUBLIC_APP_URL',
    process.env.NEXT_PUBLIC_APP_URL
  );
  const claimUrl =
    `${baseUrl}/empresa/invitacion` +
    `?token=${encodeURIComponent(invite.rawToken)}` +
    `&cr=${encodeURIComponent(invite.claimRequestId)}` +
    `&org=${encodeURIComponent(args.organizationId)}` +
    `&pack=${encodeURIComponent(args.seatPackId)}`;

  try {
    await sendLearnerEmail({
      to: email,
      subject: `Te invitaron a un curso en ${organizationName}`,
      magicLinkUrl: claimUrl,
      react: SeatInvite({
        claimUrl,
        organizationName,
        courseTitle,
        expiresInDays: INVITE_TTL_DAYS,
      }),
    });
  } catch (error) {
    console.error('seat-invite email error:', error);
    return {
      success: false,
      error: 'Generamos la invitación pero no pudimos enviar el email. Intentá de nuevo.',
    };
  }

  return { success: true, alreadyPending: false };
};
