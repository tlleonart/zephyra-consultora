'use server';

import { clearSessionCookie } from '../lib/session';
import { redirect } from 'next/navigation';

export const logout = async (): Promise<void> => {
  await clearSessionCookie();
  redirect('/login');
};
