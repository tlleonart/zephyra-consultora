'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { requestSeatInvite } from '@/features/seats/actions/request-seat-invite';
import type { Id } from '../../../../../convex/_generated/dataModel';
import type { OrgDashboardPack } from '../../types';
import styles from './InviteDialog.module.css';

interface InviteDialogProps {
  organizationId: string;
  pack: OrgDashboardPack;
  onClose: () => void;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'pending' } // already invited / link still live
  | { kind: 'error'; message: string };

/**
 * E4 — "Asignar cupo" invite dialog. Single email field (CSV is out / V1.5).
 * Calls the gated requestSeatInvite action with the pack's REAL seatPackId; the
 * action composes the claim URL + sends the SeatInvite email. An idempotent
 * re-invite (link still live) surfaces "ya invitado / link vigente" rather than
 * an error.
 *
 * WCAG: a true modal dialog (role=dialog, aria-modal, labelled by its heading),
 * focus moves to the email field on open and Escape closes it, the email input
 * is labelled, and the result is announced via aria-live.
 */
export function InviteDialog({ organizationId, pack, onClose }: InviteDialogProps) {
  const emailId = useId();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const full = pack.availableSeats <= 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim().length === 0) {
      setStatus({ kind: 'error', message: 'Ingresá el email del empleado.' });
      return;
    }
    setStatus({ kind: 'sending' });
    const result = await requestSeatInvite({
      organizationId: organizationId as Id<'lmsOrganizations'>,
      seatPackId: pack.seatPackId as Id<'lmsSeatPacks'>,
      courseId: pack.courseId as Id<'lmsCourses'>,
      employeeEmail: email.trim(),
    });
    if (!result.success) {
      setStatus({ kind: 'error', message: result.error ?? 'No pudimos enviar la invitación.' });
      return;
    }
    setStatus({ kind: result.alreadyPending ? 'pending' : 'sent' });
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="invite-title" className={styles.title}>
          Asignar cupo
        </h2>
        <p className={styles.subtitle}>
          Invitá a un empleado al curso <strong>{pack.courseTitle}</strong>. Le
          enviamos un link para que active su acceso. Quedan{' '}
          <strong>{pack.availableSeats}</strong>{' '}
          {pack.availableSeats === 1 ? 'lugar disponible' : 'lugares disponibles'}.
        </p>

        {full ? (
          <p className={styles.warning} role="alert">
            Este pack no tiene lugares disponibles. Comprá más cupos para seguir
            invitando.
          </p>
        ) : status.kind === 'sent' ? (
          <div className={styles.success} role="status" aria-live="polite">
            <p>Listo. Le enviamos la invitación a {email.trim()}.</p>
            <button type="button" className={styles.closeButton} onClick={onClose}>
              Cerrar
            </button>
          </div>
        ) : status.kind === 'pending' ? (
          <div className={styles.success} role="status" aria-live="polite">
            <p>
              Ya invitaste a {email.trim()} y el link sigue vigente. No hace falta
              enviar uno nuevo.
            </p>
            <button type="button" className={styles.closeButton} onClick={onClose}>
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            <label htmlFor={emailId} className={styles.label}>
              Email del empleado
            </label>
            <input
              ref={inputRef}
              id={emailId}
              className={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="empleado@empresa.com"
              autoComplete="off"
              required
            />
            {status.kind === 'error' ? (
              <p className={styles.error} role="alert" aria-live="assertive">
                {status.message}
              </p>
            ) : null}
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={onClose}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={styles.submitButton}
                disabled={status.kind === 'sending'}
                aria-busy={status.kind === 'sending'}
              >
                {status.kind === 'sending' ? 'Enviando…' : 'Enviar invitación'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
