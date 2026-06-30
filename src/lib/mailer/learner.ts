import { render } from '@react-email/components';
import { createTransport, type Transporter } from 'nodemailer';
import type { ReactElement } from 'react';
import { Resend } from 'resend';

export interface LearnerEmailPayload {
  to: string;
  subject: string;
  react: ReactElement;
  text?: string;
  magicLinkUrl?: string;
}

export interface SendLearnerEmailResult {
  sent: boolean;
  previewUrl?: string;
}

// Verified sender. With Resend this MUST be an address on a domain verified in
// the Resend dashboard (e.g. no-reply@zephyraconsultora.com). Override via env.
const FROM = process.env.EMAIL_FROM ?? 'Zephyra <no-reply@zephyraconsultora.com>';

// Extracted so vitest can mock the transport boundary via vi.mock('@/lib/mailer/learner').
export const getTransport = (): Transporter =>
  createTransport({
    host: 'c2810738.ferozo.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

export const sendLearnerEmail = async (
  payload: LearnerEmailPayload
): Promise<SendLearnerEmailResult> => {
  const html = await render(payload.react);
  const text =
    payload.text ?? (await render(payload.react, { plainText: true }));

  // Primary path: Resend (transactional provider). Used whenever RESEND_API_KEY
  // is set. Resend handles deliverability (SPF/DKIM on the verified domain) and,
  // unlike the shared-hosting SMTP, does not reject transactional HTML as spam.
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: FROM,
      to: payload.to,
      subject: payload.subject,
      html,
      text,
    });
    if (error) {
      throw new Error(
        `Resend send failed: ${error.message ?? JSON.stringify(error)}`
      );
    }
    return { sent: true };
  }

  // Fallback path: legacy Ferozo SMTP (kept for environments still on it).
  if (process.env.EMAIL_USER) {
    const transporter = getTransport();
    await transporter.sendMail({
      from: `"Zephyra Consultora" <${process.env.EMAIL_USER}>`,
      to: payload.to,
      subject: payload.subject,
      html,
      text,
    });
    return { sent: true };
  }

  // Dev fallback: no provider configured — render to console instead of throwing,
  // so local dev does not require credentials.
  console.warn('[mailer-dev] no RESEND_API_KEY / EMAIL_USER set; rendering to console only');
  console.warn(`[mailer-dev] to=${payload.to} subject=${payload.subject}`);
  if (payload.magicLinkUrl) {
    console.warn(`[mailer-dev] magicLinkUrl=${payload.magicLinkUrl}`);
  }
  console.warn(`[mailer-dev] html=${html.slice(0, 200)}`);
  return { sent: false, previewUrl: undefined };
};
