/**
 * E4 — requestSeatInvite server action (invite + claim-URL compose + send).
 *
 * The action is the trust boundary: it derives callerCustomerId from the
 * verified session, calls the gated mutation, and (on a fresh token) composes
 * the claim URL + sends the SeatInvite email. These tests pin the load-bearing
 * orchestration: the claim URL shape, the idempotent re-invite skip (no second
 * email), and error surfacing.
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

const getLearnerSession = vi.fn();
vi.mock('@/features/auth-learner/lib/session', () => ({
  getLearnerSession: () => getLearnerSession(),
}));

const sendLearnerEmail = vi.fn();
vi.mock('@/lib/mailer/learner', () => ({
  sendLearnerEmail: (...args: unknown[]) => sendLearnerEmail(...args),
}));

import { requestSeatInvite } from '@/features/seats/actions/request-seat-invite';

const OWNER = {
  learnerId: 'cust_owner',
  email: 'owner@empresa.com',
  type: 'org_admin' as const,
  organizationId: 'org_1',
};

const ARGS = {
  organizationId: 'org_1' as never,
  seatPackId: 'pack_1' as never,
  courseId: 'course_1' as never,
  employeeEmail: '  empleado@empresa.com  ',
};

describe('requestSeatInvite action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.zephyra.test';
    getLearnerSession.mockResolvedValue(OWNER);
    query.mockResolvedValue([
      { _id: 'course_1', title: 'Curso DEI', slug: 'dei' },
    ]);
  });

  it('composes the contract claim URL with the four params and sends the email', async () => {
    mutation.mockResolvedValueOnce({
      rawToken: 'RAW_TOKEN',
      claimRequestId: 'CR_1',
      expiresAt: Date.now() + 1000,
      alreadyPending: false,
    });
    // org name lookup (getMyOrganization)
    query.mockResolvedValueOnce([{ _id: 'course_1', title: 'Curso DEI', slug: 'dei' }]);
    query.mockResolvedValueOnce({ _id: 'org_1', name: 'Empresa S.A.' });

    const result = await requestSeatInvite(ARGS);

    expect(result).toEqual({ success: true, alreadyPending: false });
    expect(sendLearnerEmail).toHaveBeenCalledTimes(1);
    const payload = sendLearnerEmail.mock.calls[0][0];
    expect(payload.to).toBe('empleado@empresa.com'); // trimmed
    const url = new URL(payload.magicLinkUrl);
    expect(url.pathname).toBe('/empresa/invitacion');
    expect(url.searchParams.get('token')).toBe('RAW_TOKEN');
    expect(url.searchParams.get('cr')).toBe('CR_1');
    expect(url.searchParams.get('org')).toBe('org_1');
    expect(url.searchParams.get('pack')).toBe('pack_1');
  });

  it('skips the email on an idempotent re-invite (alreadyPending)', async () => {
    mutation.mockResolvedValueOnce({
      rawToken: null,
      claimRequestId: null,
      expiresAt: Date.now() + 1000,
      alreadyPending: true,
    });

    const result = await requestSeatInvite(ARGS);

    expect(result).toEqual({ success: true, alreadyPending: true });
    expect(sendLearnerEmail).not.toHaveBeenCalled();
  });

  it('surfaces a thrown mutation error (e.g. pack full) without sending', async () => {
    mutation.mockRejectedValueOnce(
      new Error('[CONVEX] el pack no tiene asientos disponibles para invitar')
    );

    const result = await requestSeatInvite(ARGS);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no tiene asientos disponibles/i);
    expect(sendLearnerEmail).not.toHaveBeenCalled();
  });

  it('rejects when there is no org-admin session', async () => {
    getLearnerSession.mockResolvedValue(null);
    const result = await requestSeatInvite(ARGS);
    expect(result.success).toBe(false);
    expect(mutation).not.toHaveBeenCalled();
  });

  it('rejects an empty employee email before calling the backend', async () => {
    const result = await requestSeatInvite({ ...ARGS, employeeEmail: '   ' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/email/i);
    expect(mutation).not.toHaveBeenCalled();
  });
});
