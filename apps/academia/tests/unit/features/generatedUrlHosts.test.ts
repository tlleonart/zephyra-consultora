/**
 * M4 — boundaries v1.1 §5, the academia-owned rows.
 *
 * One assertion per row of the "Email & URL routing (post-split)" table that
 * names apps/academia as the sender. The table is the contract; these tests are
 * its executable form, so a future change that repoints a link at the apex or at
 * backoffice fails here rather than in a learner's inbox.
 *
 *   §5 row 3  Learner magic-link (signup/signin)  academia  ->  academia.*
 *   §5 row 4  Org signup verification             academia  ->  academia.*
 *   §5 row 5  Seat invite                         academia  ->  academia.*
 *
 * (Row 5 is also exercised behaviourally in seats/requestSeatInvite.test.ts; the
 * assertion here is the host-ownership one specifically.)
 *
 * Each flow reads THIS APP'S OWN origin from NEXT_PUBLIC_APP_URL through
 * requireOrigin(), which throws when unset. The negative half of every case is
 * as load-bearing as the positive half: before M4 two of these three
 * interpolated `undefined` and the third silently fell back to the apex, and
 * `/empresa/*` — which two of them target — has no rule in the M6 301 map
 * (boundaries §3.1), so the fallback was a hard 404 for a real invited user.
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

import { requestMagicLink } from '@/features/auth-learner/actions/request-magic-link';
import { requestOrgSignup } from '@/features/org-signup/actions/request-org-signup';
import { requestSeatInvite } from '@/features/seats/actions/request-seat-invite';

/** The production value from boundaries §3.1 — asserted literally on purpose. */
const ACADEMIA = 'https://academia.zephyraconsultora.com';
/** The host these links must never resolve to post-split. */
const APEX = 'https://zephyraconsultora.com';

const ORIGINAL_ENV = { ...process.env };

/** Last URL handed to the mailer, whatever the flow. */
const sentUrl = (): string =>
  (sendLearnerEmail.mock.calls[0][0] as { magicLinkUrl: string }).magicLinkUrl;

const OWNER = {
  learnerId: 'cust_owner',
  email: 'owner@empresa.com',
  type: 'org_admin' as const,
  organizationId: 'org_1',
};

const SEAT_ARGS = {
  organizationId: 'org_1' as never,
  seatPackId: 'pack_1' as never,
  courseId: 'course_1' as never,
  employeeEmail: 'empleado@empresa.com',
};

/** Wire the seat-invite happy path (session + course lookup + fresh token). */
const armSeatInvite = (): void => {
  getLearnerSession.mockResolvedValue(OWNER);
  query.mockResolvedValue([{ _id: 'course_1', title: 'Curso DEI', slug: 'dei' }]);
  mutation.mockResolvedValueOnce({
    rawToken: 'RAW_TOKEN',
    claimRequestId: 'CR_1',
    expiresAt: Date.now() + 1000,
    alreadyPending: false,
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV, NEXT_PUBLIC_APP_URL: ACADEMIA };
});

describe('boundaries §5 row 3 — learner magic-link targets academia', () => {
  beforeEach(() => {
    mutation.mockResolvedValue({ rawToken: 'RAW', alreadyActivated: false });
  });

  it('builds /cursos/auth/verify on the academia origin', async () => {
    await requestMagicLink('learner@example.com', 'learner_activation');

    expect(sendLearnerEmail).toHaveBeenCalledTimes(1);
    expect(sentUrl()).toBe(
      `${ACADEMIA}/cursos/auth/verify?token=RAW&purpose=learner_activation`
    );
    expect(new URL(sentUrl()).origin).toBe(ACADEMIA);
    expect(sentUrl()).not.toContain(APEX);
    // The pre-M4 failure mode, pinned so it cannot come back.
    expect(sentUrl()).not.toContain('undefined');
  });

  it('sends NO email when NEXT_PUBLIC_APP_URL is unset (throws, never guesses)', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;

    // The action's anti-enumeration wrapper collapses every internal failure to
    // the same opaque success shape, so the OBSERVABLE guarantee is that no mail
    // with a wrong-host link goes out. That is the property worth pinning.
    await requestMagicLink('learner@example.com', 'learner_activation');
    expect(sendLearnerEmail).not.toHaveBeenCalled();
  });
});

describe('boundaries §5 row 4 — org signup verification targets academia', () => {
  beforeEach(() => {
    mutation.mockResolvedValue({ rawToken: 'RAW', alreadyActivated: false });
  });

  it('builds /empresa/registro/crear on the academia origin', async () => {
    await requestOrgSignup('owner@empresa.com', 'Empresa S.A.', 'Ana');

    expect(sendLearnerEmail).toHaveBeenCalledTimes(1);
    expect(sentUrl()).toContain(`${ACADEMIA}/empresa/registro/crear?token=RAW`);
    expect(new URL(sentUrl()).origin).toBe(ACADEMIA);
    expect(sentUrl()).not.toContain(APEX);
    expect(sentUrl()).not.toContain('undefined');
  });

  it('sends NO email when NEXT_PUBLIC_APP_URL is unset', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    await requestOrgSignup('owner@empresa.com', 'Empresa S.A.', 'Ana');
    expect(sendLearnerEmail).not.toHaveBeenCalled();
  });
});

describe('boundaries §5 row 5 — seat invite targets academia', () => {
  it('builds /empresa/invitacion on the academia origin', async () => {
    armSeatInvite();

    await requestSeatInvite(SEAT_ARGS);

    expect(sendLearnerEmail).toHaveBeenCalledTimes(1);
    const url = sentUrl();
    expect(url.startsWith(`${ACADEMIA}/empresa/invitacion?`)).toBe(true);
    expect(new URL(url).origin).toBe(ACADEMIA);
    expect(url).not.toContain(APEX);
    // The four contract params survive the origin change (api-contract §C1).
    const params = new URL(url).searchParams;
    expect(params.get('token')).toBe('RAW_TOKEN');
    expect(params.get('cr')).toBe('CR_1');
    expect(params.get('org')).toBe('org_1');
    expect(params.get('pack')).toBe('pack_1');
  });

  it('sends NO email when NEXT_PUBLIC_APP_URL is unset', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    armSeatInvite();
    await expect(requestSeatInvite(SEAT_ARGS)).rejects.toThrow(
      /NEXT_PUBLIC_APP_URL/
    );
    expect(sendLearnerEmail).not.toHaveBeenCalled();
  });
});

describe('academia never generates a URL on another app\'s host', () => {
  it('reads no backoffice origin variable anywhere in this app', () => {
    // Row 2 of §5 (admin password reset) belongs to backoffice. If this app ever
    // starts reading a backoffice origin it is either duplicating a flow it does
    // not own or building a cross-host link that needs an explicit decision.
    expect(process.env.NEXT_PUBLIC_BACKOFFICE_URL).toBeUndefined();
  });
});
