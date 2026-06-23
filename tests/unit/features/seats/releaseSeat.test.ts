/**
 * E5 — releaseSeat server action (marcar baja).
 *
 * Pins: owner-gated, the "started learner" rejection message is surfaced
 * clearly, and a non-owner session is rejected before the backend call.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mutation } = vi.hoisted(() => ({ mutation: vi.fn() }));
vi.mock('convex/browser', () => ({
  ConvexHttpClient: class {
    mutation = mutation;
  },
}));

const getLearnerSession = vi.fn();
vi.mock('@/features/auth-learner/lib/session', () => ({
  getLearnerSession: () => getLearnerSession(),
}));

import { releaseSeat } from '@/features/seats/actions/release-seat';

const ARGS = { organizationId: 'org_1' as never, seatId: 'seat_1' as never };

describe('releaseSeat action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLearnerSession.mockResolvedValue({
      learnerId: 'cust_owner',
      type: 'org_admin',
      organizationId: 'org_1',
    });
  });

  it('succeeds for an unstarted seat', async () => {
    mutation.mockResolvedValueOnce({ seatId: 'seat_1', enrollmentId: 'enr_1', released: true });
    const result = await releaseSeat(ARGS);
    expect(result).toEqual({ success: true });
  });

  it('surfaces the "learner ya comenzó" rejection clearly', async () => {
    mutation.mockRejectedValueOnce(
      new Error(
        '[CONVEX] no se puede liberar un asiento de un learner que ya comenzó el curso'
      )
    );
    const result = await releaseSeat(ARGS);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/ya comenzó el curso/i);
  });

  it('rejects a non-owner session before the backend call', async () => {
    getLearnerSession.mockResolvedValue({ learnerId: 'x', type: 'org_learner' });
    const result = await releaseSeat(ARGS);
    expect(result.success).toBe(false);
    expect(mutation).not.toHaveBeenCalled();
  });
});
