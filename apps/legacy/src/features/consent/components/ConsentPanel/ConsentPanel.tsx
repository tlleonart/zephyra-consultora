'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@zephyra/convex/_generated/api';
import type { Id } from '@zephyra/convex/_generated/dataModel';
import {
  grantProgressConsent,
  revokeProgressConsent,
} from '../../actions/consent-actions';
import styles from './ConsentPanel.module.css';

interface ConsentPanelProps {
  learnerId: Id<'lmsCustomers'>;
  organizationId: Id<'lmsOrganizations'>;
  organizationName: string;
}

/**
 * E6 — learner-side progress-consent control (api-contract §D2).
 *
 * DEFAULT OPT-OUT: getMyConsentState returns [] until the learner explicitly
 * grants, so the honest default rendered here is "no compartís tu progreso
 * nominal". This panel toggles the ORG-WIDE consent (courseId omitted) — the V1
 * surface; course-scoped consent is supported by the backend but not exposed in
 * the learner UI yet.
 *
 * The server is the consent authority: after a grant/revoke we re-read
 * getMyConsentState (reactive useQuery) rather than trusting a local flag, so
 * the rendered state always reflects the persisted row.
 *
 * WCAG: the status is conveyed in text (not color alone), the toggle is a real
 * button with an explicit accessible name, the busy state uses aria-busy, and
 * the result region is aria-live so a screen reader announces the change.
 */
export function ConsentPanel({
  learnerId,
  organizationId,
  organizationName,
}: ConsentPanelProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const state = useQuery(api.lms.consent.getMyConsentState, {
    learnerCustomerId: learnerId,
    organizationId,
  });

  // Org-wide consent = the row whose courseId is undefined. Default opt-out.
  const orgWide = state?.consents.find((c) => c.courseId === undefined);
  const granted = orgWide?.granted === true;

  const loading = state === undefined;

  const handleToggle = async () => {
    setPending(true);
    setError(null);
    const result = granted
      ? await revokeProgressConsent()
      : await grantProgressConsent();
    if (!result.success) {
      setError(result.error ?? 'No pudimos actualizar tu preferencia.');
    }
    // The reactive getMyConsentState query updates the rendered state on its own
    // once the mutation commits; no local optimistic flag.
    setPending(false);
  };

  return (
    <section className={styles.panel} aria-labelledby="consent-title">
      <h2 id="consent-title" className={styles.title}>
        Compartir mi progreso con {organizationName}
      </h2>
      <p className={styles.lead}>
        Tu organización puede ver el avance agregado de su equipo sin tu nombre.
        Tu progreso nominal —con tu identidad— solo se comparte si vos lo
        autorizás. Podés cambiar esta preferencia cuando quieras.
      </p>

      {loading ? (
        <p className={styles.loading}>Cargando tu preferencia…</p>
      ) : (
        <div className={styles.control}>
          <div className={styles.statusRow}>
            <span
              className={`${styles.badge} ${granted ? styles.badgeOn : styles.badgeOff}`}
            >
              {granted ? 'Autorizado' : 'No autorizado'}
            </span>
            <p className={styles.statusText}>
              {granted
                ? `Autorizaste a ${organizationName} a ver tu progreso con tu nombre.`
                : `No compartís tu progreso nominal. ${organizationName} solo ve datos agregados de su equipo.`}
            </p>
          </div>

          <button
            type="button"
            className={granted ? styles.revokeButton : styles.grantButton}
            onClick={handleToggle}
            disabled={pending}
            aria-busy={pending}
          >
            {pending
              ? 'Guardando…'
              : granted
                ? 'Dejar de compartir mi progreso'
                : 'Autorizar compartir mi progreso'}
          </button>

          {error ? (
            <p className={styles.error} role="alert" aria-live="assertive">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
