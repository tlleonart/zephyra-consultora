/**
 * M4 — boundaries v1.1 §5, row 2. The backoffice-owned row.
 *
 *   §5 row 2  Admin password reset  backoffice  ->  backoffice.*
 *
 * /reset-password is served by THIS app and is not in the M6 301 map (boundaries
 * §3.1 lists only /cursos/:path* and /admin/:path*), so the link has to name
 * backoffice.* explicitly — there is no redirect that would rescue a wrong host.
 *
 * Pre-M4 this line read `${process.env.NEXT_PUBLIC_APP_URL}/reset-password` with
 * no guard, so an unset variable mailed an admin `undefined/reset-password`. Both
 * halves are asserted: the right host when configured, and no mail at all when
 * not.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mutation } = vi.hoisted(() => ({ mutation: vi.fn() }));
vi.mock('convex/browser', () => ({
  ConvexHttpClient: class {
    mutation = mutation;
  },
}));

const sendMail = vi.fn();
const createTransport = vi.fn((opts: unknown) => {
  void opts;
  return { sendMail };
});
vi.mock('nodemailer', () => ({
  createTransport: (opts: unknown) => createTransport(opts),
}));

// Typed payload so `resendSend.mock.calls[0][0]` is a `{ html }` and not `never`
// — an untyped vi.fn() gives a zero-length tuple and tsc rejects the index.
const resendSend = vi.fn(async (payload: { html: string }) => {
  void payload;
  return { error: null as { message?: string } | null };
});
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: resendSend };
  },
}));

import { requestPasswordReset } from '@/features/auth/actions/password-reset';

/** Production origin of apps/backoffice (boundaries v1.1 §3.1). */
const BACKOFFICE = 'https://backoffice.zephyraconsultora.com';
/** The two hosts this link must never resolve to. */
const APEX = 'https://zephyraconsultora.com';
const ACADEMIA = 'https://academia.zephyraconsultora.com';

const ORIGINAL_ENV = { ...process.env };

/** The HTML body handed to whichever provider was used. */
const sentHtml = (): string => resendSend.mock.calls[0][0].html;

beforeEach(() => {
  vi.clearAllMocks();
  process.env = {
    ...ORIGINAL_ENV,
    NEXT_PUBLIC_APP_URL: BACKOFFICE,
    RESEND_API_KEY: 're_test',
  };
  mutation.mockResolvedValue({
    token: 'RESET_TOKEN',
    userEmail: 'admin@zephyraconsultora.com',
    userName: 'Admin',
  });
});

describe('boundaries §5 row 2 — admin password reset targets backoffice', () => {
  it('builds /reset-password on the backoffice origin', async () => {
    const result = await requestPasswordReset('admin@zephyraconsultora.com');

    expect(result.success).toBe(true);
    expect(resendSend).toHaveBeenCalledTimes(1);
    expect(sentHtml()).toContain(`${BACKOFFICE}/reset-password?token=RESET_TOKEN`);
  });

  it('does not point the reset link at the apex or at academia', async () => {
    await requestPasswordReset('admin@zephyraconsultora.com');

    const html = sentHtml();
    // The apex would 404: post-split it serves the institutional site only, and
    // /reset-password has no 301 rule.
    expect(html).not.toContain(`${APEX}/reset-password`);
    expect(html).not.toContain(`${ACADEMIA}/reset-password`);
    // The pre-M4 failure mode.
    expect(html).not.toContain('undefined/reset-password');
  });

  it('sends NO email when NEXT_PUBLIC_APP_URL is unset', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;

    await requestPasswordReset('admin@zephyraconsultora.com');

    expect(resendSend).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('holds no learner origin variable (this app links to its own host only)', () => {
    // Row 2 is backoffice's ONLY email. Its cross-host links to academia are UI
    // navigation, covered by tests/unit/app/crossHostLinks.test.ts (V28) — they
    // must never be built from NEXT_PUBLIC_APP_URL, which is this host.
    expect(process.env.NEXT_PUBLIC_APP_URL).toBe(BACKOFFICE);
  });
});
