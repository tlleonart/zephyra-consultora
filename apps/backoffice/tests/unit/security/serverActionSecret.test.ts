/**
 * SERVER_ACTION_SECRET in apps/backoffice.
 *
 *  1. The password-reset action sends the secret and fails closed (no Convex
 *     call, no mail, same opaque success) when the variable is unset.
 *  2. When Convex withholds the token (unknown email or per-admin limit) the
 *     action sends no mail and replies exactly as when it sends one.
 *  3. The secret is only read from 'use server' modules (source guard behind
 *     the post-deploy bundle grep, CA-6).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mutation } = vi.hoisted(() => ({ mutation: vi.fn() }));
vi.mock('convex/browser', () => ({
  ConvexHttpClient: class {
    mutation = mutation;
  },
}));

const resendSend = vi.fn(async (payload: { html: string }) => {
  void payload;
  return { error: null as { message?: string } | null };
});
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: resendSend };
  },
}));
vi.mock('nodemailer', () => ({
  createTransport: () => ({ sendMail: vi.fn() }),
}));

import { requestPasswordReset } from '@/features/auth/actions/password-reset';

const ORIGINAL_ENV = { ...process.env };
const SECRET = ORIGINAL_ENV.SERVER_ACTION_SECRET as string;

beforeEach(() => {
  vi.clearAllMocks();
  process.env = {
    ...ORIGINAL_ENV,
    NEXT_PUBLIC_APP_URL: 'https://backoffice.zephyra.test',
    RESEND_API_KEY: 're_test',
  };
});

describe('requestPasswordReset action', () => {
  it('sends the secret to Convex', async () => {
    mutation.mockResolvedValue({
      success: true,
      token: 'T',
      userName: 'A',
      userEmail: 'a@b.com',
    });
    await requestPasswordReset('a@b.com');
    expect(mutation.mock.calls[0][1]).toEqual({
      email: 'a@b.com',
      serverSecret: SECRET,
    });
  });

  it('fails closed when SERVER_ACTION_SECRET is unset', async () => {
    delete process.env.SERVER_ACTION_SECRET;
    const res = await requestPasswordReset('a@b.com');
    expect(mutation).not.toHaveBeenCalled();
    expect(resendSend).not.toHaveBeenCalled();
    expect(res).toEqual({ success: true });
  });

  it('a withheld token (limit or unknown email) sends no mail and looks the same', async () => {
    mutation.mockResolvedValueOnce({
      success: true,
      token: 'T',
      userName: 'A',
      userEmail: 'a@b.com',
    });
    const sent = await requestPasswordReset('a@b.com');
    expect(resendSend).toHaveBeenCalledTimes(1);

    resendSend.mockClear();
    mutation.mockResolvedValueOnce({ success: true });
    const limited = await requestPasswordReset('a@b.com');
    expect(resendSend).not.toHaveBeenCalled();
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

  it('is read only by the password-reset action', () => {
    const rel = readers.map((f) => path.relative(SRC, f).split(path.sep).join('/'));
    expect(rel).toEqual(['features/auth/actions/password-reset.ts']);
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
