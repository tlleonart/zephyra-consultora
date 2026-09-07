import type { LearnerSessionPayload } from './session';

/**
 * La proyección de la sesión de la alumna que SÍ puede cruzar al navegador.
 *
 * `LearnerSessionPayload` (session.ts) es el payload del JWT y lleva cosas que
 * no tienen por qué viajar al cliente: `learnerId` (el id de `lmsCustomers`,
 * que identifica la fila real), `organizationId` (a qué empresa pertenece) y
 * `exp` (cuándo vence la cookie). Nada de eso hace falta para pintar la barra,
 * y todo eso queda legible en el HTML servido y en el payload RSC apenas se
 * baje como prop a un componente cliente.
 *
 * Por eso el layout público NO baja el payload: baja ESTO. Es una lista blanca,
 * no una lista negra — si mañana `LearnerSessionPayload` gana un campo nuevo,
 * el campo no se filtra por omisión, hay que agregarlo acá a propósito.
 *
 * (SPEC §4 y AC 11.)
 */
export interface PublicLearnerSession {
  email: string;
  type: 'individual' | 'org_admin' | 'org_learner';
}

/**
 * Los ÚNICOS campos que la proyección deja pasar. Exportado para que el test
 * de AC 11 compare contra esta constante en vez de repetir la lista a mano:
 * agrandar la lista sin decidirlo rompe el test.
 */
export const PUBLIC_LEARNER_SESSION_FIELDS = ['email', 'type'] as const;

/**
 * Proyecta el payload del servidor a lo que puede ver el cliente.
 *
 * Pura y sin dependencias de `next/headers`, así que la puede importar tanto un
 * server component (para producir la prop) como un componente cliente (para
 * tipar la prop que recibe) sin arrastrar `cookies()` al bundle del navegador.
 */
export const toPublicLearnerSession = (
  payload: LearnerSessionPayload | null | undefined
): PublicLearnerSession | null => {
  if (!payload) return null;
  return { email: payload.email, type: payload.type };
};
