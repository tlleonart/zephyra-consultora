'use server';

import { ConvexHttpClient } from 'convex/browser';
import { api } from '@zephyra/convex/_generated/api';
import { Id } from '@zephyra/convex/_generated/dataModel';
import { getLearnerSession } from '@/features/auth-learner/lib/session';

export interface NominalProgressEnrollment {
  status: string;
  progressPercent: number;
  scoreRaw?: number;
  lessonStatus?: string;
  firstTouchedAt?: number;
  updatedAt: number;
}

export type NominalProgressResult =
  | {
      success: true;
      consented: true;
      learnerId: Id<'lmsCustomers'>;
      email: string;
      enrollment: NominalProgressEnrollment | null;
    }
  | { success: true; consented: false }
  | { success: false; error: string };

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// The contract's exact server-side denial message (Habeas Data). We match on
// "consint" / "consent" defensively in case the prefix differs.
const CONSENT_DENIAL = /consinti|consent|acceso denegado/i;

/**
 * E6 — admin nominal-progress read (api-contract §D1 getNominalProgress).
 *
 * The privacy gate is SERVER-SIDE: getNominalProgress THROWS
 * "acceso denegado: el learner no consintió compartir su progreso nominal"
 * unless the learner granted consent. We NEVER reconstruct nominal progress from
 * the roster + aggregate as a workaround — we call the gated function and map
 * the thrown denial to a { consented: false } state so the UI can render the
 * "sin consentimiento — solo agregado" message. Any OTHER throw is a real error.
 */
export const getNominalProgress = async (args: {
  organizationId: Id<'lmsOrganizations'>;
  learnerCustomerId: Id<'lmsCustomers'>;
  courseId: Id<'lmsCourses'>;
}): Promise<NominalProgressResult> => {
  const session = await getLearnerSession();
  if (!session || session.type !== 'org_admin') {
    return { success: false, error: 'Iniciá sesión como administrador de la empresa.' };
  }

  try {
    const result = await convex.query(api.lms.seats.getNominalProgress, {
      callerCustomerId: session.learnerId,
      organizationId: args.organizationId,
      learnerCustomerId: args.learnerCustomerId,
      courseId: args.courseId,
    });
    return {
      success: true,
      consented: true,
      learnerId: result.learnerId,
      email: result.email,
      enrollment: result.enrollment,
    };
  } catch (error) {
    const raw = error instanceof Error ? error.message : '';
    // Consent denial is the EXPECTED branch — not an error. Map it to the
    // "sin consentimiento" state rather than surfacing a failure.
    if (CONSENT_DENIAL.test(raw)) {
      return { success: true, consented: false };
    }
    const message = raw
      ? raw.replace(/^\[.*?\]\s*/, '').replace(/^.*?Error:\s*/, '')
      : 'No pudimos leer el progreso nominal.';
    return { success: false, error: message };
  }
};
