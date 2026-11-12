/**
 * POST /api/send-mail — abuse guards on the public contact form.
 *
 *  - honeypot filled -> no mail, same success reply (the bot learns nothing)
 *  - sixth send from the same IP inside the hour -> 429, no mail
 *  - name over 100 / content over 5000 / malformed email -> 400, no mail
 *  - the email that reaches replyTo is the validated one
 *  - the form ships the honeypot hidden and out of the tab order
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const resendSend = vi.fn(async (payload: { replyTo?: string }) => {
  void payload;
  return { error: null as { message?: string } | null };
});
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: resendSend };
  },
}));
const sendMail = vi.fn();
vi.mock('nodemailer', () => ({
  createTransport: () => ({ sendMail }),
}));

import { POST } from '@/app/api/send-mail/route';
import { createIpLimiter, isValidEmail } from '@/lib/contact-guard';

let ipCounter = 0;
const freshIp = () => `203.0.113.${++ipCounter}`;

const VALID = {
  name: 'Ana',
  email: 'ana@example.com',
  content: 'Hola, quiero consultar por un taller.',
};

const post = (body: unknown, ip = freshIp()) =>
  POST(
    new NextRequest('http://localhost/api/send-mail', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-real-ip': ip },
      body: JSON.stringify(body),
    })
  );

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_API_KEY = 're_test';
});

describe('POST /api/send-mail', () => {
  it('sends a valid message with the validated email as replyTo', async () => {
    const res = await post({ ...VALID, website: '' });
    expect(res.status).toBe(200);
    expect(resendSend).toHaveBeenCalledTimes(1);
    expect(resendSend.mock.calls[0][0].replyTo).toBe('ana@example.com');
  });

  it('honeypot filled: no mail, and the same reply as a real send', async () => {
    const real = await post(VALID);
    resendSend.mockClear();
    const bot = await post({ ...VALID, website: 'http://spam.example' });
    expect(bot.status).toBe(real.status);
    expect(await bot.json()).toEqual(await real.json());
    expect(resendSend).not.toHaveBeenCalled();
  });

  it('the sixth send from one IP in the hour is rejected with 429', async () => {
    const ip = freshIp();
    for (let i = 0; i < 5; i++) {
      expect((await post(VALID, ip)).status).toBe(200);
    }
    expect(resendSend).toHaveBeenCalledTimes(5);
    const sixth = await post(VALID, ip);
    expect(sixth.status).toBe(429);
    expect(resendSend).toHaveBeenCalledTimes(5);
    // Another IP is unaffected.
    expect((await post(VALID)).status).toBe(200);
  });

  it('rejects a name over 100 characters with 400', async () => {
    const res = await post({ ...VALID, name: 'a'.repeat(101) });
    expect(res.status).toBe(400);
    expect(resendSend).not.toHaveBeenCalled();
  });

  it('accepts a name of exactly 100 characters', async () => {
    expect((await post({ ...VALID, name: 'a'.repeat(100) })).status).toBe(200);
  });

  it('rejects content over 5000 characters with 400', async () => {
    const res = await post({ ...VALID, content: 'x'.repeat(5001) });
    expect(res.status).toBe(400);
    expect(resendSend).not.toHaveBeenCalled();
  });

  it.each([
    'no-arroba',
    'a@b',
    'a b@example.com',
    'a@example.com\r\nBcc: x@y.com',
    'Ana <ana@example.com>',
  ])('rejects the malformed email %j with 400', async (email) => {
    const res = await post({ ...VALID, email });
    expect(res.status).toBe(400);
    expect(resendSend).not.toHaveBeenCalled();
  });

  it('rejects missing fields and non-JSON bodies with 400', async () => {
    expect((await post({ name: 'Ana' })).status).toBe(400);
    const res = await POST(
      new NextRequest('http://localhost/api/send-mail', {
        method: 'POST',
        body: 'not json',
      })
    );
    expect(res.status).toBe(400);
    expect(resendSend).not.toHaveBeenCalled();
  });
});

describe('contact-guard helpers', () => {
  it('the limiter frees a slot once the hour has passed', () => {
    const limiter = createIpLimiter(5, 60 * 60 * 1000);
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) expect(limiter.allow('ip', t0 + i)).toBe(true);
    expect(limiter.allow('ip', t0 + 10)).toBe(false);
    expect(limiter.allow('ip', t0 + 60 * 60 * 1000 + 1)).toBe(true);
  });

  it('isValidEmail accepts ordinary addresses', () => {
    expect(isValidEmail('tomas.lopez+zephyra@sub.example.com.ar')).toBe(true);
  });
});

describe('the contact form ships the honeypot', () => {
  const page = fs.readFileSync(
    path.resolve(__dirname, '../../src/app/(public)/contacto/page.tsx'),
    'utf8'
  );

  it('sends a `website` field to the API', () => {
    expect(page).toMatch(/website,\s*\n\s*\}\)/);
  });

  it('the input is out of the tab order and hidden from assistive tech', () => {
    const input = page.match(/<input[^>]*id="website"[^>]*>/)?.[0] ?? '';
    expect(input).toContain('tabIndex={-1}');
    expect(input).toContain('autoComplete="off"');
    expect(page).toMatch(/aria-hidden="true"[\s\S]{0,200}left: "-10000px"/);
  });
});
