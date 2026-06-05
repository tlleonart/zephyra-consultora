'use server';

import { redirect } from 'next/navigation';
import { clearLearnerSessionCookie } from '../lib/session';

export const signOutLearner = async (): Promise<void> => {
  await clearLearnerSessionCookie();
  redirect('/cursos');
};
