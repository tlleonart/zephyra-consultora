'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { claimSeat } from '@/features/seats/actions/claim-seat';
import type { Id } from '../../../../../convex/_generated/dataModel';
import styles from './ClaimContent.module.css';

interface ClaimContentProps {
  token: string;
  claimRequestId: string;
  organizationId: string;
  seatPackId: string;
}

type Phase =
  | { kind: 'form' }
  | { kind: 'claiming' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; alreadyClaimed: boolean; courseSlug?: string };

/**
 * E4 — claim flow UI. Collects/confirms the employee email (the token's email
 * must match), calls the gated claimSeat action, then routes into the player.
 *
 * The action signs the org_learner session on success, so the player gate
 * (getMyEnrollment) passes on redirect. Replay (alreadyClaimed) lands on the
 * same player. Over-claim / burned token / dedup surface the server's
 * Spanish message inline.
 *
 * WCAG: labelled email input, the claim result is aria-live, the CTA is a real
 * button, errors use role=alert.
 */
export function ClaimContent({
  token,
  claimRequestId,
  organizationId,
  seatPackId,
}: ClaimContentProps) {
  const emailId = useId();
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'form' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim().length === 0) {
      setPhase({ kind: 'error', message: 'Ingresá tu email para activar el acceso.' });
      return;
    }
    setPhase({ kind: 'claiming' });
    const result = await claimSeat({
      token,
      claimRequestId,
      organizationId: organizationId as Id<'lmsOrganizations'>,
      seatPackId: seatPackId as Id<'lmsSeatPacks'>,
      employeeEmail: email.trim(),
    });
    if (!result.success) {
      setPhase({ kind: 'error', message: result.error ?? 'No pudimos activar tu acceso.' });
      return;
    }
    setPhase({
      kind: 'done',
      alreadyClaimed: result.alreadyClaimed ?? false,
      courseSlug: result.courseSlug,
    });
  };

  if (phase.kind === 'done') {
    const playerHref = phase.courseSlug
      ? `/cursos/${phase.courseSlug}/player`
      : '/cursos';
    return (
      <div className={styles.done} role="status" aria-live="polite">
        <span className={styles.doneIcon} aria-hidden="true">
          ✓
        </span>
        <p className={styles.doneText}>
          {phase.alreadyClaimed
            ? 'Tu acceso ya estaba activo. Entrá al curso para continuar.'
            : '¡Listo! Tu acceso quedó activo. Ya podés empezar el curso.'}
        </p>
        <button
          type="button"
          className={styles.cta}
          onClick={() => {
            // Hard navigation (not router.push): the org_learner session cookie
            // was just set by the claimSeat server action; a full page load
            // guarantees the browser sends it so the player's enrollment gate
            // (getLearnerSession) passes instead of bouncing to sign-in.
            window.location.assign(playerHref);
          }}
        >
          Ir al curso
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form} noValidate>
      <p className={styles.lead}>
        Confirmá el email al que te enviaron la invitación para activar tu lugar.
      </p>
      <label htmlFor={emailId} className={styles.label}>
        Tu email
      </label>
      <input
        id={emailId}
        className={styles.input}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="vos@empresa.com"
        autoComplete="email"
        required
      />
      {phase.kind === 'error' ? (
        <p className={styles.error} role="alert" aria-live="assertive">
          {phase.message}
        </p>
      ) : null}
      <button
        type="submit"
        className={styles.cta}
        disabled={phase.kind === 'claiming'}
        aria-busy={phase.kind === 'claiming'}
      >
        {phase.kind === 'claiming' ? 'Activando…' : 'Activar mi acceso'}
      </button>
      <Link href="/cursos" className={styles.footerLink}>
        ¿Problemas con el link? Ver el catálogo
      </Link>
    </form>
  );
}
