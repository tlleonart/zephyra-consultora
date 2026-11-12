/**
 * SERVER_ACTION_SECRET in apps/academia.
 *
 *  1. Every server action that asks Convex for a raw token sends the secret,
 *     and fails closed (no Convex call, no mail) when the variable is unset.
 *  2. When Convex withholds the token because of the per-email limit
 *     (rawToken: null), no mail goes out and the browser gets the same reply
 *     as for a sent link.
 *  3. The secret is only read from 'use server' modules, so it cannot end up
 *     in a client bundle (the bundle grep after deploy is CA-6; this is the
 *     source-level guard that keeps it true).
 */
import fs from 'node:fs';
import path from 'node:path';
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

const ORIGINAL_ENV = { ...process.env };
const SECRET = ORIGINAL_ENV.SERVER_ACTION_SECRET as string;

const SEAT_ARGS = {
  organizationId: 'org_1' as never,
  seatPackId: 'pack_1' as never,
  courseId: 'course_1' as never,
  employeeEmail: 'empleado@empresa.com',
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env = {
    ...ORIGINAL_ENV,
    NEXT_PUBLIC_APP_URL: 'https://academia.zephyra.test',
  };
  getLearnerSession.mockResolvedValue({
    learnerId: 'cust_owner',
    email: 'owner@empresa.com',
    type: 'org_admin',
    organizationId: 'org_1',
  });
  query.mockResolvedValue([]);
});

describe('the actions send the secret to Convex', () => {
  it('requestMagicLink', async () => {
    mutation.mockResolvedValue({ rawToken: 'RAW', alreadyActivated: false });
    await requestMagicLink('a@b.com', 'learner_signin');
    expect(mutation.mock.calls[0][1]).toMatchObject({ serverSecret: SECRET });
  });

  it('requestOrgSignup', async () => {
    mutation.mockResolvedValue({ rawToken: 'RAW', alreadyActivated: false });
    await requestOrgSignup('a@b.com', 'Org', 'Ana');
    expect(mutation.mock.calls[0][1]).toMatchObject({ serverSecret: SECRET });
  });

  it('requestSeatInvite', async () => {
    mutation.mockResolvedValue({
      rawToken: 'RAW',
      claimRequestId: 'CR',
      expiresAt: 1,
      alreadyPending: false,
    });
    await requestSeatInvite(SEAT_ARGS);
    expect(mutation.mock.calls[0][1]).toMatchObject({ serverSecret: SECRET });
  });
});

describe('fail closed when SERVER_ACTION_SECRET is unset', () => {
  beforeEach(() => {
    delete process.env.SERVER_ACTION_SECRET;
  });

  it('requestMagicLink: no Convex call, no mail, opaque success', async () => {
    const res = await requestMagicLink('a@b.com', 'learner_signin');
    expect(mutation).not.toHaveBeenCalled();
    expect(sendLearnerEmail).not.toHaveBeenCalled();
    expect(res.success).toBe(true);
  });

  it('requestOrgSignup: no Convex call, no mail', async () => {
    await requestOrgSignup('a@b.com', 'Org', 'Ana');
    expect(mutation).not.toHaveBeenCalled();
    expect(sendLearnerEmail).not.toHaveBeenCalled();
  });

  it('requestSeatInvite: no Convex call, no mail, generic error', async () => {
    const res = await requestSeatInvite(SEAT_ARGS);
    expect(mutation).not.toHaveBeenCalled();
    expect(sendLearnerEmail).not.toHaveBeenCalled();
    expect(res.success).toBe(false);
    expect(res.error).not.toMatch(/SERVER_ACTION_SECRET/);
  });
});

describe('per-email limit (rawToken: null) at the action', () => {
  it('requestMagicLink sends no mail and replies exactly as when it sends one', async () => {
    mutation.mockResolvedValueOnce({ rawToken: 'RAW', expiresAt: 1, alreadyActivated: false });
    const sent = await requestMagicLink('a@b.com', 'learner_signin');
    expect(sendLearnerEmail).toHaveBeenCalledTimes(1);

    sendLearnerEmail.mockClear();
    mutation.mockResolvedValueOnce({ rawToken: null, expiresAt: null, alreadyActivated: false });
    const limited = await requestMagicLink('a@b.com', 'learner_signin');
    expect(sendLearnerEmail).not.toHaveBeenCalled();
    expect(limited).toEqual(sent);
  });

  it('requestOrgSignup sends no mail and replies exactly as when it sends one', async () => {
    mutation.mockResolvedValueOnce({ rawToken: 'RAW', expiresAt: 1, alreadyActivated: false });
    const sent = await requestOrgSignup('a@b.com', 'Org', 'Ana');
    sendLearnerEmail.mockClear();
    mutation.mockResolvedValueOnce({ rawToken: null, expiresAt: null, alreadyActivated: false });
    const limited = await requestOrgSignup('a@b.com', 'Org', 'Ana');
    expect(sendLearnerEmail).not.toHaveBeenCalled();
    expect(limited).toEqual(sent);
  });
});

// ---------------------------------------------------------------------------
// Source guard: SERVER_ACTION_SECRET is only read from 'use server' modules.
// ---------------------------------------------------------------------------

const SRC = path.resolve(__dirname, '../../../src');

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx|js|jsx|mjs)$/.test(entry.name) ? [full] : [];
  });

/** First statement of the file, ignoring leading comments and blank lines. */
const directiveOf = (source: string): string | null => {
  const stripped = source.replace(/^(\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/, '');
  const m = stripped.match(/^['"](use server|use client)['"]/);
  return m ? m[1] : null;
};

describe('SERVER_ACTION_SECRET never reaches client code', () => {
  const files = walk(SRC);
  const readers = files.filter((f) =>
    fs.readFileSync(f, 'utf8').includes('SERVER_ACTION_SECRET')
  );

  it('is read by exactly the three token-requesting actions', () => {
    const rel = readers
      .map((f) => path.relative(SRC, f).split(path.sep).join('/'))
      .sort();
    expect(rel).toEqual([
      'features/auth-learner/actions/request-magic-link.ts',
      'features/org-signup/actions/request-org-signup.ts',
      'features/seats/actions/request-seat-invite.ts',
    ]);
  });

  it("every reader is a 'use server' module", () => {
    for (const f of readers) {
      expect(directiveOf(fs.readFileSync(f, 'utf8')), f).toBe('use server');
    }
  });

  it('no source uses a NEXT_PUBLIC_ variant', () => {
    for (const f of files) {
      expect(fs.readFileSync(f, 'utf8'), f).not.toMatch(/NEXT_PUBLIC_\w*SERVER_ACTION/);
    }
  });
});
