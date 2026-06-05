import { render } from '@react-email/components';
import { createTransport, type Transporter } from 'nodemailer';
import type { ReactElement } from 'react';

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

  // Dev fallback: when SMTP creds are absent we render to console instead of
  // throwing, so local dev does not require Ferozo credentials.
  if (!process.env.EMAIL_USER) {
    console.warn(
      '[mailer-dev] EMAIL_USER not set; rendering to console only'
    );
    console.warn(`[mailer-dev] to=${payload.to} subject=${payload.subject}`);
    if (payload.magicLinkUrl) {
      console.warn(`[mailer-dev] magicLinkUrl=${payload.magicLinkUrl}`);
    }
    console.warn(`[mailer-dev] html=${html.slice(0, 200)}`);
    return { sent: false, previewUrl: undefined };
  }

  const transporter = getTransport();
  await transporter.sendMail({
    from: `"Zephyra Consultora" <${process.env.EMAIL_USER}>`,
    to: payload.to,
    subject: payload.subject,
    html,
    text,
  });

  return { sent: true };
};
