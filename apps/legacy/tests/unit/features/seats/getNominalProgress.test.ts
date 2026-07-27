/**
 * E6 — getNominalProgress server action (consent-gate mapping).
 *
 * The privacy gate is SERVER-SIDE: the Convex query THROWS without consent. This
 * action maps that thrown denial to a { consented: false } state (the
 * "sin consentimiento" branch) WITHOUT reconstructing nominal data from any
 * other source. Pins: denial → consented:false; granted → consented:true with
 * data; a non-consent error → success:false.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('convex/browser', () => ({
  ConvexHttpClient: class {
    query = query;
  },
}));

const getLearnerSession = vi.fn();
vi.mock('@/features/auth-learner/lib/session', () => ({
  getLearnerSession: () => getLearnerSession(),
}));

import { getNominalProgress } from '@/features/seats/actions/get-nominal-progress';

const ARGS = {
  organizationId: 'org_1' as never,
  learnerCustomerId: 'cust_emp' as never,
  courseId: 'course_1' as never,
};

describe('getNominalProgress action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLearnerSession.mockResolvedValue({
      learnerId: 'cust_owner',
      type: 'org_admin',
      organizationId: 'org_1',
    });
  });

  it('maps the server-side consent denial to consented:false', async () => {
    query.mockRejectedValueOnce(
      new Error(
        '[CONVEX] acceso denegado: el learner no consintió compartir su progreso nominal'
      )
    );
    const result = await getNominalProgress(ARGS);
    expect(result).toEqual({ success: true, consented: false });
  });

  it('returns nominal data when the learner consented', async () => {
    query.mockResolvedValueOnce({
      learnerId: 'cust_emp',
      email: 'emp@empresa.com',
      courseId: 'course_1',
      enrollment: { status: 'active', progressPercent: 42, updatedAt: 1 },
    });
    const result = await getNominalProgress(ARGS);
    expect(result).toMatchObject({
      success: true,
      consented: true,
      email: 'emp@empresa.com',
      enrollment: { progressPercent: 42 },
    });
  });

  it('surfaces a non-consent error as a real failure', async () => {
    query.mockRejectedValueOnce(new Error('[CONVEX] no autorizado'));
    const result = await getNominalProgress(ARGS);
    expect(result.success).toBe(false);
  });

  it('rejects when there is no org-admin session', async () => {
    getLearnerSession.mockResolvedValue(null);
    const result = await getNominalProgress(ARGS);
    expect(result.success).toBe(false);
    expect(query).not.toHaveBeenCalled();
  });
});
