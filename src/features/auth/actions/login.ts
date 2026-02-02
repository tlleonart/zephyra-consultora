'use server';

import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../convex/_generated/api';
import { createSession, setSessionCookie } from '../lib/session';
import { redirect } from 'next/navigation';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export interface LoginResult {
  success: boolean;
  error?: string;
}

export const login = async (
  email: string,
  password: string
): Promise<LoginResult> => {
  try {
    const user = await convex.mutation(api.adminUsers.login, {
      email,
      password,
    });

    const token = await createSession({
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    await setSessionCookie(token);

    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error al iniciar sesión';
    return { success: false, error: message };
  }
};

export const loginAndRedirect = async (
  formData: FormData
): Promise<void> => {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const result = await login(email, password);
  if (result.success) {
    redirect('/admin');
  }
};
