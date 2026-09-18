'use server';

import { redirect } from 'next/navigation';
import { clearLearnerSessionCookie } from '../lib/session';

export const signOutLearner = async (): Promise<void> => {
  await clearLearnerSessionCookie();
  redirect('/cursos');
};

/**
 * UAT2. Cierra la sesión personal y lleva al ingreso con destino al panel de
 * empresa.
 *
 * Existe porque "¿Ya tenés una empresa registrada? Iniciá sesión" no podía
 * funcionar con una sesión abierta: el ingreso ve que ya hay alguien adentro y
 * devuelve al `returnTo` (/empresa), y /empresa, a quien no es dueña, le
 * muestra la propuesta pública. Las testers lo vivieron como "me manda al
 * inicio de la página". Para entrar con OTRA cuenta primero hay que salir de
 * ésta, y eso lo tiene que hacer el botón, no la persona.
 *
 * El destino es fijo a propósito: una acción que recibiera a dónde ir sería
 * una redirección abierta más para validar.
 */
export const signOutToOrgSignin = async (): Promise<void> => {
  await clearLearnerSessionCookie();
  redirect('/cursos/auth/signin?returnTo=/empresa');
};
