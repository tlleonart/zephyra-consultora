/**
 * E6 — learner consent server actions (grant / revoke).
 *
 * Pins: the learnerCustomerId + organizationId are derived from the session
 * (never client), grant/revoke dispatch to the right mutation, and a session
 * without an org is rejected (an individual learner has no org to share with).
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

import {
  grantProgressConsent,
  revokeProgressConsent,
} from '@/features/consent/actions/consent-actions';

describe('consent actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLearnerSession.mockResolvedValue({
      learnerId: 'cust_emp',
      type: 'org_learner',
      organizationId: 'org_1',
    });
  });

  it('grant derives identity from the session and returns granted:true', async () => {
    mutation.mockResolvedValueOnce({ consentId: 'c_1', granted: true });
    const result = await grantProgressConsent();
    expect(result).toEqual({ success: true, granted: true });
    expect(mutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        learnerCustomerId: 'cust_emp',
        organizationId: 'org_1',
        courseId: undefined,
      })
    );
  });

  it('revoke returns granted:false', async () => {
    mutation.mockResolvedValueOnce({ consentId: 'c_1', granted: false });
    const result = await revokeProgressConsent();
    expect(result).toEqual({ success: true, granted: false });
  });

  it('rejects a session without an organization', async () => {
    getLearnerSession.mockResolvedValue({
      learnerId: 'cust_ind',
      type: 'individual',
    });
    const result = await grantProgressConsent();
    expect(result.success).toBe(false);
    expect(mutation).not.toHaveBeenCalled();
  });
});
