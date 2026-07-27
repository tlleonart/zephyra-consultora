/**
 * E4 — claimSeat server action (claim + session mint + slug resolution).
 *
 * Pins: a successful claim mints the org_learner session cookie and resolves the
 * enrolled course slug so the landing routes into the player; a replay surfaces
 * alreadyClaimed; a thrown error (over-claim / burned token) is surfaced.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mutation, query } = vi.hoisted(() => ({
  mutation: vi.fn(),
  query: vi.fn(),
}));
vi.mock('convex/browser', () => ({
  ConvexHttpClient: class {
    mutation = mutation;
    query = query;
  },
}));

const createLearnerSession = vi.fn();
const setLearnerSessionCookie = vi.fn();
vi.mock('@/features/auth-learner/lib/session', () => ({
  createLearnerSession: (...a: unknown[]) => createLearnerSession(...a),
  setLearnerSessionCookie: (...a: unknown[]) => setLearnerSessionCookie(...a),
}));

import { claimSeat } from '@/features/seats/actions/claim-seat';

const ARGS = {
  token: 'RAW',
  claimRequestId: 'CR_1',
  organizationId: 'org_1' as never,
  seatPackId: 'pack_1' as never,
  employeeEmail: 'empleado@empresa.com',
};

describe('claimSeat action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createLearnerSession.mockResolvedValue('SIGNED_JWT');
  });

  it('mints the org_learner session and resolves the course slug on a fresh claim', async () => {
    mutation.mockResolvedValueOnce({
      seatId: 'seat_1',
      enrollmentId: 'enr_1',
      learnerId: 'cust_emp',
      alreadyClaimed: false,
    });
    // listMyEnrollments → courses.listPublished
    query.mockResolvedValueOnce([{ _id: 'enr_1', courseId: 'course_1', status: 'active' }]);
    query.mockResolvedValueOnce([{ _id: 'course_1', title: 'Curso DEI', slug: 'dei' }]);

    const result = await claimSeat(ARGS);

    expect(result).toEqual({ success: true, alreadyClaimed: false, courseSlug: 'dei' });
    expect(createLearnerSession).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'cust_emp', type: 'org_learner', organizationId: 'org_1' })
    );
    expect(setLearnerSessionCookie).toHaveBeenCalledWith('SIGNED_JWT');
  });

  it('returns alreadyClaimed on an idempotent replay', async () => {
    mutation.mockResolvedValueOnce({
      seatId: 'seat_1',
      enrollmentId: 'enr_1',
      learnerId: 'cust_emp',
      alreadyClaimed: true,
    });
    query.mockResolvedValueOnce([{ _id: 'enr_1', courseId: 'course_1', status: 'active' }]);
    query.mockResolvedValueOnce([{ _id: 'course_1', title: 'Curso DEI', slug: 'dei' }]);

    const result = await claimSeat(ARGS);
    expect(result.success).toBe(true);
    expect(result.alreadyClaimed).toBe(true);
  });

  it('surfaces a thrown over-claim error and does not mint a session', async () => {
    mutation.mockRejectedValueOnce(
      new Error('[CONVEX] no hay asientos disponibles en el pack')
    );
    const result = await claimSeat(ARGS);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no hay asientos disponibles/i);
    expect(setLearnerSessionCookie).not.toHaveBeenCalled();
  });

  it('rejects an empty email before calling the backend', async () => {
    const result = await claimSeat({ ...ARGS, employeeEmail: '  ' });
    expect(result.success).toBe(false);
    expect(mutation).not.toHaveBeenCalled();
  });
});
