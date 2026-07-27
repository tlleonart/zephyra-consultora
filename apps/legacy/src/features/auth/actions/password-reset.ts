'use server';

import { ConvexHttpClient } from 'convex/browser';
import { api } from '@zephyra/convex/_generated/api';
import { createTransport } from 'nodemailer';
import { Resend } from 'resend';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const EMAIL_FROM =
  process.env.EMAIL_FROM ?? 'Zephyra <no-reply@zephyraconsultora.com>';

export interface RequestResetResult {
  success: boolean;
  error?: string;
}

export const requestPasswordReset = async (
  email: string
): Promise<RequestResetResult> => {
  try {
    const result = await convex.mutation(api.adminUsers.requestPasswordReset, {
      email,
    });

    // If we got a token, send the email
    if (result.token && result.userEmail) {
      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${result.token}`;
      const subject = 'Restablecer contraseña - Zephyra Consultora';
      const html = `
          <h1>Hola ${result.userName},</h1>
          <p>Has solicitado restablecer tu contraseña.</p>
          <p>Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>Este enlace expira en 1 hora.</p>
          <p>Si no solicitaste este cambio, puedes ignorar este email.</p>
          <br/>
          <p>- Equipo Zephyra Consultora</p>
        `;

      // Primary: Resend. Fallback: legacy Ferozo SMTP when RESEND_API_KEY absent.
      if (process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { error } = await resend.emails.send({
          from: EMAIL_FROM,
          to: result.userEmail,
          subject,
          html,
        });
        if (error) {
          throw new Error(
            `Resend send failed: ${error.message ?? JSON.stringify(error)}`
          );
        }
      } else {
        const transporter = createTransport({
          host: 'c2810738.ferozo.com',
          port: 465,
          secure: true,
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD,
          },
        });
        await transporter.sendMail({
          from: `"Zephyra Consultora" <${process.env.EMAIL_USER}>`,
          to: result.userEmail,
          subject,
          html,
        });
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Password reset error:', error);
    // Always return success to prevent email enumeration
    return { success: true };
  }
};

export interface ResetPasswordResult {
  success: boolean;
  error?: string;
}

export const resetPassword = async (
  token: string,
  newPassword: string
): Promise<ResetPasswordResult> => {
  try {
    await convex.mutation(api.adminUsers.resetPassword, {
      token,
      newPassword,
    });

    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error al restablecer contraseña';
    return { success: false, error: message };
  }
};
