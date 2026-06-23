'use client';

import { useEffect, useState } from 'react';
import {
  getNominalProgress,
  type NominalProgressResult,
} from '@/features/seats/actions/get-nominal-progress';
import type { Id } from '../../../../../convex/_generated/dataModel';
import type { OrgDashboardMember } from '../../types';
import styles from './NominalProgressDialog.module.css';

interface NominalProgressDialogProps {
  organizationId: string;
  member: OrgDashboardMember;
  onClose: () => void;
}

/**
 * E6 — admin nominal-progress drill-down. The privacy gate is SERVER-SIDE: the
 * action calls getNominalProgress (which THROWS without consent) and maps the
 * denial to { consented: false }. This dialog renders the
 * "sin consentimiento — solo agregado" state for a non-consented learner and the
 * per-learner detail ONLY when the server returns consented data. The dashboard
 * default is aggregate; this nominal view is opt-in per learner AND gated.
 *
 * We NEVER reconstruct nominal progress from the roster + aggregate — the only
 * source is the gated function.
 */
export function NominalProgressDialog({
  organizationId,
  member,
  onClose,
}: NominalProgressDialogProps) {
  const [result, setResult] = useState<NominalProgressResult | null>(null);

  useEffect(() => {
    let active = true;
    getNominalProgress({
      organizationId: organizationId as Id<'lmsOrganizations'>,
      learnerCustomerId: member.learnerId as Id<'lmsCustomers'>,
      courseId: member.courseId as Id<'lmsCourses'>,
    }).then((r) => {
      if (active) setResult(r);
    });
    return () => {
      active = false;
    };
  }, [organizationId, member.learnerId, member.courseId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nominal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="nominal-title" className={styles.title}>
          Progreso de {member.email}
        </h2>
        <p className={styles.course}>{member.courseTitle}</p>

        <div className={styles.body} aria-live="polite">
          {result === null ? (
            <p className={styles.loading}>Cargando…</p>
          ) : result.success === false ? (
            <p className={styles.error} role="alert">
              {result.error}
            </p>
          ) : result.consented === false ? (
            <div className={styles.noConsent}>
              <span className={styles.noConsentBadge}>Sin consentimiento</span>
              <p className={styles.noConsentText}>
                Esta persona todavía no autorizó compartir su progreso nominal.
                Solo podés ver el avance <strong>agregado</strong> de su curso
                —sin identificar a cada persona— en el panel de progreso.
              </p>
            </div>
          ) : result.enrollment === null ? (
            <p className={styles.loading}>
              Esta persona todavía no tiene actividad registrada en el curso.
            </p>
          ) : (
            <dl className={styles.detail}>
              <div className={styles.detailRow}>
                <dt>Estado</dt>
                <dd>{translateStatus(result.enrollment.status)}</dd>
              </div>
              <div className={styles.detailRow}>
                <dt>Avance</dt>
                <dd>{result.enrollment.progressPercent}%</dd>
              </div>
              {typeof result.enrollment.scoreRaw === 'number' ? (
                <div className={styles.detailRow}>
                  <dt>Puntaje</dt>
                  <dd>{result.enrollment.scoreRaw}</dd>
                </div>
              ) : null}
              {result.enrollment.lessonStatus ? (
                <div className={styles.detailRow}>
                  <dt>Estado de lección</dt>
                  <dd>{result.enrollment.lessonStatus}</dd>
                </div>
              ) : null}
            </dl>
          )}
        </div>

        <button type="button" className={styles.closeButton} onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

function translateStatus(status: string): string {
  switch (status) {
    case 'active':
      return 'En curso';
    case 'completed':
      return 'Completado';
    case 'expired':
      return 'Dado de baja';
    default:
      return status;
  }
}
