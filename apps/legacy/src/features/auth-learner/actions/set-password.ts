'use server';

import { ConvexHttpClient } from 'convex/browser';
import { api } from '@zephyra/convex/_generated/api';
import { getLearnerSession } from '../lib/session';

export interface SetPasswordResult {
  success: boolean;
  error?: string;
}

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export const setLearnerPassword = async (
  password: string
): Promise<SetPasswordResult> => {
  const session = await getLearnerSession();
  if (!session) {
    return { success: false, error: 'sesión inválida' };
  }

  try {
    await convex.mutation(api.lms.auth.setLearnerPassword, {
      learnerId: session.learnerId,
      password,
    });
    return { success: true };
  } catch (error) {
    const raw =
      error instanceof Error
        ? error.message
        : 'No se pudo actualizar la contraseña';
    const cleaned = raw
      .replace(/^.*AuthError:\s*/, '')
      .split(/\n|\s+at\s/)[0];
    return {
      success: false,
      error: cleaned || 'No se pudo actualizar la contraseña',
    };
  }
};
