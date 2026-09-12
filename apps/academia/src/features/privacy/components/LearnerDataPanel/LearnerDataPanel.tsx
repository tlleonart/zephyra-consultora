'use client';

import { useState } from 'react';
import { btnClass } from '@zephyra/ui';
import { requestAccountDeletion } from '../../actions/request-account-deletion';
import styles from './LearnerDataPanel.module.css';

/**
 * UAT1 / U4 — la pantalla de datos de una alumna sin organización.
 *
 * POR QUE EXISTE. `/cursos/privacidad` rebotaba al catálogo a quien no tuviera
 * `organizationId`, o sea a toda alumna B2C, mientras el menú de cuenta y el
 * encabezado del reproductor ofrecían el enlace igual, sin condición. Las
 * testers encontraron esa puerta por los dos lados: "cuando tocás privacidad de
 * mi progreso no te deja editar nada, te redirige al catálogo" y "desde mi
 * cuenta, 'Ir a privacidad' también vuelve al catálogo".
 *
 * El rebote era deliberado y estaba documentado como decisión diferida en
 * `account-menu-links.ts`: *"sería decidir por producto que una alumna sin
 * empresa no tiene superficie de derechos de datos. Esa decisión no se toma
 * desde acá."* Tomás la tomó el 2026-09-12: la alumna B2C tiene pantalla.
 *
 * QUE MUESTRA Y QUE NO. Acceso y baja, que es el mínimo de ARCO que se puede
 * sostener hoy. La exportación de datos queda para más adelante — prometerla
 * acá sin construirla sería repetir el defecto que vinimos a arreglar, que era
 * exactamente una pantalla afirmando algo que no pasaba.
 *
 * LA BAJA NO SE EJECUTA SOLA, y no es una limitación técnica: `lmsCustomers`
 * registra `deletedBy` contra `adminUsers` y ninguna alumna puede figurar ahí
 * (PDD H-2). El pedido abre el trámite; lo cierra una persona. Lo que la
 * pantalla promete es lo que pasa.
 */
export interface LearnerDataPanelProps {
  email: string;
}

type Estado = 'inicial' | 'confirmando' | 'enviando' | 'enviado' | 'error';

export function LearnerDataPanel({ email }: LearnerDataPanelProps) {
  const [estado, setEstado] = useState<Estado>('inicial');
  const [error, setError] = useState('');

  const pedirBaja = async () => {
    setEstado('enviando');
    setError('');
    const result = await requestAccountDeletion();
    if (result.success) {
      setEstado('enviado');
    } else {
      setError(result.error ?? 'No pudimos registrar el pedido.');
      setEstado('error');
    }
  };

  return (
    <div className={styles.panel}>
      <section className={styles.card} aria-labelledby="que-guardamos">
        <h2 id="que-guardamos" className={styles.cardTitle}>
          Qué guardamos de vos
        </h2>
        <dl className={styles.dataList}>
          <div className={styles.dataRow}>
            <dt className={styles.dataTerm}>Tu correo</dt>
            <dd className={styles.dataValue}>
              {email} — es con lo que entrás, y a donde te mandamos el link de
              ingreso.
            </dd>
          </div>
          <div className={styles.dataRow}>
            <dt className={styles.dataTerm}>Tu avance en los cursos</dt>
            <dd className={styles.dataValue}>
              Qué módulos viste, dónde quedaste y tu puntaje. Sirve para que
              puedas retomar donde dejaste.
            </dd>
          </div>
          <div className={styles.dataRow}>
            <dt className={styles.dataTerm}>Tus compras</dt>
            <dd className={styles.dataValue}>
              Qué cursos compraste y cuándo. Los datos de la tarjeta nunca pasan
              por la Academia: los maneja MercadoPago.
            </dd>
          </div>
        </dl>
        <p className={styles.note}>
          No compartimos tu avance con nadie. Si algún día entrás con un cupo que
          te da una empresa, vas a ver acá mismo qué se comparte con ella y vas a
          poder decidirlo.
        </p>
      </section>

      <section className={styles.card} aria-labelledby="dar-de-baja">
        <h2 id="dar-de-baja" className={styles.cardTitle}>
          Dar de baja mi cuenta
        </h2>

        {estado === 'enviado' ? (
          <div className={styles.success} role="status" aria-live="polite">
            <p className={styles.successTitle}>Pedido registrado.</p>
            <p className={styles.successText}>
              El equipo de Zephyra lo va a procesar y te va a escribir a{' '}
              <strong>{email}</strong>. Hasta entonces tu cuenta sigue activa y
              podés seguir usándola con normalidad.
            </p>
          </div>
        ) : (
          <>
            <p className={styles.cardText}>
              Podés pedir que demos de baja tu cuenta y borremos tus datos. El
              pedido lo procesa una persona del equipo, así que no es inmediato:
              te vamos a escribir para confirmarlo.
            </p>
            <p className={styles.warning}>
              Tené en cuenta que al darte de baja perdés el acceso a los cursos
              que hayas comprado.
            </p>

            {estado === 'confirmando' ? (
              <div className={styles.confirmRow}>
                <p className={styles.confirmText}>
                  ¿Confirmás que querés pedir la baja?
                </p>
                <div className={styles.confirmActions}>
                  <button
                    type="button"
                    className={btnClass({ variant: 'primary', size: 'sm' })}
                    onClick={pedirBaja}
                  >
                    Sí, pedir la baja
                  </button>
                  <button
                    type="button"
                    className={btnClass({ variant: 'outline', size: 'sm' })}
                    onClick={() => setEstado('inicial')}
                  >
                    Mejor no
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className={btnClass({ variant: 'outline', size: 'sm' })}
                onClick={() => setEstado('confirmando')}
                disabled={estado === 'enviando'}
              >
                {estado === 'enviando'
                  ? 'Registrando el pedido…'
                  : 'Pedir la baja de mi cuenta'}
              </button>
            )}

            {estado === 'error' && error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
