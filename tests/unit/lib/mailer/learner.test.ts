/**
 * Unit tests for src/lib/mailer/learner.ts + src/emails/LearnerMagicLink.tsx.
 *
 * Why we mock nodemailer instead of the wrapper's `getTransport` seam:
 *   `vi.mock('nodemailer', ...)` intercepts the import at module-graph build
 *   time so the wrapper's own `createTransport(...)` call inside
 *   `getTransport` lands on our spy. Mocking `getTransport` from `@/lib/...`
 *   would only work if we re-imported the module after `vi.doMock`, which
 *   adds friction and is not what the A02 seam comment requests in practice.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@react-email/components';
import LearnerMagicLink from '../../../../src/emails/LearnerMagicLink';

const sendMailMock = vi.fn();

vi.mock('nodemailer', () => ({
  createTransport: vi.fn(() => ({ sendMail: sendMailMock })),
}));

describe('sendLearnerEmail — dev fallback + transport mock', () => {
  const originalEmailUser = process.env.EMAIL_USER;
  const originalEmailPassword = process.env.EMAIL_PASSWORD;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sendMailMock.mockReset();
    sendMailMock.mockResolvedValue({ messageId: 'test-id' });
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    if (originalEmailUser === undefined) delete process.env.EMAIL_USER;
    else process.env.EMAIL_USER = originalEmailUser;
    if (originalEmailPassword === undefined) delete process.env.EMAIL_PASSWORD;
    else process.env.EMAIL_PASSWORD = originalEmailPassword;
  });

  it('returns { sent: false } and warns when EMAIL_USER is unset (dev fallback)', async () => {
    delete process.env.EMAIL_USER;
    const { sendLearnerEmail } = await import('../../../../src/lib/mailer/learner');

    const result = await sendLearnerEmail({
      to: 'learner@example.com',
      subject: 'Tu link de ingreso a Zephyra',
      react: LearnerMagicLink({
        magicLinkUrl: 'https://example.com/verify?token=abc&purpose=learner_signin',
        purpose: 'learner_signin',
        expiresInMinutes: 15,
      }),
      magicLinkUrl: 'https://example.com/verify?token=abc&purpose=learner_signin',
    });

    expect(result.sent).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('calls transport.sendMail with subject, html, text when EMAIL_USER is set', async () => {
    process.env.EMAIL_USER = 'noreply@zephyra.test';
    process.env.EMAIL_PASSWORD = 'unit-test-secret';
    const { sendLearnerEmail } = await import('../../../../src/lib/mailer/learner');

    const result = await sendLearnerEmail({
      to: 'learner@example.com',
      subject: 'Activá tu cuenta de Zephyra',
      react: LearnerMagicLink({
        magicLinkUrl: 'https://example.com/verify?token=tok123&purpose=learner_activation',
        purpose: 'learner_activation',
        expiresInMinutes: 30,
      }),
    });

    expect(result.sent).toBe(true);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const call = sendMailMock.mock.calls[0][0];
    expect(call.to).toBe('learner@example.com');
    expect(call.subject).toBe('Activá tu cuenta de Zephyra');
    expect(typeof call.html).toBe('string');
    expect(call.html).toContain('Bienvenido a Zephyra');
    expect(typeof call.text).toBe('string');
    expect(call.text.length).toBeGreaterThan(0);
    expect(call.from).toContain('noreply@zephyra.test');
  });
});

describe('LearnerMagicLink — purpose-aware rendering', () => {
  // The rendered HTML escapes `&` to `&amp;` inside attribute values, so we
  // assert on segments of the URL rather than the literal querystring.
  it('renders activation copy + magic link URL', async () => {
    const html = await render(
      LearnerMagicLink({
        magicLinkUrl: 'https://app.example.com/cursos/auth/verify?token=tokA&purpose=learner_activation',
        purpose: 'learner_activation',
        expiresInMinutes: 30,
      })
    );
    expect(html).toContain('Bienvenido a Zephyra');
    expect(html).toContain('Activá tu cuenta');
    expect(html).toContain('Activar cuenta');
    expect(html).toContain('token=tokA');
    expect(html).toContain('purpose=learner_activation');
    expect(html).toContain('30 minutos');
  });

  it('renders signin copy + magic link URL', async () => {
    const html = await render(
      LearnerMagicLink({
        magicLinkUrl: 'https://app.example.com/cursos/auth/verify?token=tokB&purpose=learner_signin',
        purpose: 'learner_signin',
        expiresInMinutes: 15,
      })
    );
    expect(html).toContain('Tu link de ingreso a Zephyra');
    expect(html).toContain('Iniciar sesión');
    expect(html).toContain('token=tokB');
    expect(html).toContain('purpose=learner_signin');
    expect(html).toContain('15 minutos');
  });

  it('renders recovery copy + magic link URL', async () => {
    const html = await render(
      LearnerMagicLink({
        magicLinkUrl: 'https://app.example.com/cursos/auth/verify?token=tokC&purpose=learner_recovery',
        purpose: 'learner_recovery',
        expiresInMinutes: 15,
      })
    );
    expect(html).toContain('Recuperá tu acceso a Zephyra');
    expect(html).toContain('Recuperar acceso');
    expect(html).toContain('token=tokC');
    expect(html).toContain('purpose=learner_recovery');
    expect(html).toContain('15 minutos');
  });
});
