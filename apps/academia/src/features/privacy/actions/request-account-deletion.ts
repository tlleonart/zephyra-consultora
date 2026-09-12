'use server';

import { getLearnerSession } from '@/features/auth-learner/lib/session';
import { sendLearnerEmail } from '@/lib/mailer/learner';
import AccountDeletionRequest from '@/emails/AccountDeletionRequest';

/**
 * UAT1 / U4 — el pedido de baja de una alumna, que NO ejecuta la baja.
 *
 * POR QUE NO BORRA NADA. `lmsCustomers` tiene borrado blando con `deletedBy`
 * apuntando a `adminUsers`, y el esquema lo dice con todas las letras:
 * "Learners NEVER appear as deletedBy in ANY row (PDD H-2 mitigation):
 * self-initiated Habeas Data deletions are processed by an admin, who is the
 * recorded actor". Asi que esta accion ABRE UN PEDIDO y nada mas: avisa a
 * Zephyra, que lo procesa. Si algun dia esto escribe `deletedAt`, rompe esa
 * invariante y el registro de quien borro a quien deja de ser cierto.
 *
 * Es el mismo criterio que ya rige el alta y la transferencia de duena de
 * empresa (modelo comercial §9.2): tramite con persona del otro lado, no boton
 * que ejecuta. No es una limitacion tecnica, es la decision que ya estaba
 * tomada para los tramites que tienen consecuencias.
 *
 * LA IDENTIDAD SALE DE LA COOKIE, nunca del cliente. El formulario no manda
 * correo: quien pide la baja es quien tiene la sesion, y punto. Aceptar un
 * correo del cliente convertiria esto en una forma de pedir la baja de
 * cualquiera.
 */

export interface RequestAccountDeletionResult {
  success: boolean;
  error?: string;
}

// A donde llega el pedido. Es la misma direccion que el pie del sitio publica
// como contacto de Zephyra; se deja overrideable por entorno para que el dia
// que exista una casilla de privacidad dedicada no haya que tocar codigo.
const PRIVACY_INBOX =
  process.env.ZEPHYRA_PRIVACY_INBOX ?? 'info@zephyraconsultora.com';

export const requestAccountDeletion =
  async (): Promise<RequestAccountDeletionResult> => {
    const session = await getLearnerSession();
    if (!session) {
      return { success: false, error: 'Iniciá sesión para pedir la baja.' };
    }

    try {
      await sendLearnerEmail({
        to: PRIVACY_INBOX,
        subject: `Pedido de baja de cuenta — ${session.email}`,
        react: AccountDeletionRequest({
          learnerEmail: session.email,
          requestedAt: new Date().toISOString(),
        }),
      });
      return { success: true };
    } catch (error) {
      // A diferencia del link magico, aca NO se colapsa el error en un exito:
      // no hay nada que enumerar —quien pide la baja ya probo quien es con la
      // cookie— y decirle "listo" a alguien cuyo pedido no salio seria dejarlo
      // esperando una baja que nadie va a procesar.
      console.error('account-deletion-request error:', error);
      return {
        success: false,
        error:
          'No pudimos registrar el pedido. Escribinos a ' +
          PRIVACY_INBOX +
          ' y lo resolvemos.',
      };
    }
  };
