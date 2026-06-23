'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { releaseSeat } from '@/features/seats/actions/release-seat';
import type { Id } from '../../../../../convex/_generated/dataModel';
import type { OrgDashboardData, OrgDashboardMember } from '../../types';
import { InviteDialog } from '../InviteDialog';
import { NominalProgressDialog } from '../NominalProgressDialog';
import styles from './OrgDashboard.module.css';

interface OrgDashboardProps {
  data: OrgDashboardData;
}

/**
 * E5 — Org-Admin dashboard body. Three sections:
 *  1. Contracted courses (pack cards): total / asignados / disponibles + the
 *     Asignar cupo (invite) · Comprar más cupos (→ catalog) · Ver progreso CTAs.
 *  2. Aggregate progress per course (getOrgCourseProgress — NO identities). The
 *     dashboard DEFAULT is this aggregate view.
 *  3. Members (getOrgRoster — display email only): Marcar baja (releaseSeat) +
 *     Ver progreso nominal (gated, opt-in per learner).
 *
 * Upsell CTAs (Comprar más cupos) are visible but non-invasive (a secondary
 * link on each pack card, not a banner). WCAG: section headings, a labelled
 * data table for the roster, aria-live status for release results, dialogs are
 * modal + focus-managed.
 */
export function OrgDashboard({ data }: OrgDashboardProps) {
  const router = useRouter();
  const [invitePackId, setInvitePackId] = useState<string | null>(null);
  const [nominalMember, setNominalMember] = useState<OrgDashboardMember | null>(null);
  const [releaseState, setReleaseState] = useState<
    Record<string, { kind: 'releasing' } | { kind: 'error'; message: string }>
  >({});
  const [, startTransition] = useTransition();

  const invitePack = data.packs.find((p) => p.seatPackId === invitePackId) ?? null;

  const handleRelease = async (member: OrgDashboardMember) => {
    const confirmed = window.confirm(
      `¿Dar de baja a ${member.email} de ${member.courseTitle}? El lugar vuelve al pool y se puede reasignar. Solo se puede si la persona todavía no empezó el curso.`
    );
    if (!confirmed) return;

    setReleaseState((s) => ({ ...s, [member.seatId]: { kind: 'releasing' } }));
    const result = await releaseSeat({
      organizationId: data.organizationId as Id<'lmsOrganizations'>,
      seatId: member.seatId as Id<'lmsSeats'>,
    });
    if (!result.success) {
      setReleaseState((s) => ({
        ...s,
        [member.seatId]: {
          kind: 'error',
          message: result.error ?? 'No pudimos dar de baja el lugar.',
        },
      }));
      return;
    }
    // Success: refresh the server data so the roster + pack balance update.
    setReleaseState((s) => {
      const next = { ...s };
      delete next[member.seatId];
      return next;
    });
    startTransition(() => router.refresh());
  };

  const onInviteClose = () => {
    setInvitePackId(null);
    // Refresh so a freshly-consumed seat (if claimed quickly) reflects.
    startTransition(() => router.refresh());
  };

  return (
    <div className={styles.dashboard}>
      {/* ---- Contracted courses (pack cards) ---- */}
      <section aria-labelledby="packs-title" className={styles.section}>
        <h2 id="packs-title" className={styles.sectionTitle}>
          Cursos contratados
        </h2>
        <ul className={styles.packGrid} role="list">
          {data.packs.map((pack) => (
            <li key={pack.seatPackId} className={styles.packCard}>
              <h3 className={styles.packTitle}>{pack.courseTitle}</h3>
              <dl className={styles.packStats}>
                <div className={styles.packStat}>
                  <dt>Total</dt>
                  <dd>{pack.totalSeats}</dd>
                </div>
                <div className={styles.packStat}>
                  <dt>Asignados</dt>
                  <dd>{pack.claimedSeats}</dd>
                </div>
                <div className={styles.packStat}>
                  <dt>Disponibles</dt>
                  <dd
                    className={pack.availableSeats === 0 ? styles.statZero : undefined}
                    data-testid="pack-available"
                  >
                    {pack.availableSeats}
                  </dd>
                </div>
              </dl>
              <div className={styles.packActions}>
                <button
                  type="button"
                  className={styles.primaryAction}
                  onClick={() => setInvitePackId(pack.seatPackId)}
                  disabled={pack.availableSeats === 0}
                >
                  Asignar cupo
                </button>
                <Link
                  href={
                    pack.courseSlug
                      ? `/empresa/cursos/${pack.courseSlug}`
                      : '/empresa/cursos'
                  }
                  className={styles.secondaryAction}
                >
                  Comprar más cupos
                </Link>
                <a href="#progreso" className={styles.tertiaryAction}>
                  Ver progreso
                </a>
              </div>
              {pack.availableSeats === 0 ? (
                <p className={styles.packNote}>
                  Todos los lugares están asignados. Comprá más para invitar a más
                  personas.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {/* ---- Aggregate progress (default view, no identities) ---- */}
      <section aria-labelledby="progreso-title" className={styles.section} id="progreso">
        <h2 id="progreso-title" className={styles.sectionTitle}>
          Avance del equipo
        </h2>
        <p className={styles.sectionLead}>
          Avance agregado por curso. No incluye nombres: el progreso nominal solo
          se muestra para quienes lo autorizaron.
        </p>
        {data.progress.length === 0 ? (
          <p className={styles.empty}>
            Todavía no hay avances para mostrar. En cuanto tu equipo empiece, vas a
            ver el progreso acá.
          </p>
        ) : (
          <ul className={styles.progressGrid} role="list">
            {data.progress.map((c) => (
              <li key={c.courseId} className={styles.progressCard}>
                <h3 className={styles.progressTitle}>{c.courseTitle}</h3>
                <div className={styles.progressBarWrap}>
                  <div
                    className={styles.progressBar}
                    role="progressbar"
                    aria-valuenow={c.avgProgressPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Avance promedio de ${c.courseTitle}`}
                  >
                    <span
                      className={styles.progressFill}
                      style={{ width: `${c.avgProgressPercent}%` }}
                    />
                  </div>
                  <span className={styles.progressPct}>
                    {c.avgProgressPercent}% promedio
                  </span>
                </div>
                <dl className={styles.progressStats}>
                  <div>
                    <dt>Asignados</dt>
                    <dd>{c.totalClaimed}</dd>
                  </div>
                  <div>
                    <dt>Completaron</dt>
                    <dd>{c.completed}</dd>
                  </div>
                  <div>
                    <dt>En curso</dt>
                    <dd>{c.inProgress}</dd>
                  </div>
                  <div>
                    <dt>Sin empezar</dt>
                    <dd>{c.notStarted}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Members (roster — display email only) ---- */}
      <section aria-labelledby="roster-title" className={styles.section}>
        <h2 id="roster-title" className={styles.sectionTitle}>
          Equipo
        </h2>
        {data.members.length === 0 ? (
          <p className={styles.empty}>
            Todavía no asignaste lugares. Usá <strong>Asignar cupo</strong> en un
            curso para invitar a tu equipo.
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className={styles.tableCaption}>
                Personas con un lugar asignado. La membresía no implica acceso a su
                progreso nominal.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col">Curso</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((m) => {
                  const rs = releaseState[m.seatId];
                  return (
                    <tr key={m.seatId}>
                      <td>{m.email}</td>
                      <td>{m.courseTitle}</td>
                      <td>
                        <div className={styles.rowActions}>
                          <button
                            type="button"
                            className={styles.rowAction}
                            onClick={() => setNominalMember(m)}
                          >
                            Ver progreso
                          </button>
                          <button
                            type="button"
                            className={styles.rowActionDanger}
                            onClick={() => handleRelease(m)}
                            disabled={rs?.kind === 'releasing'}
                            aria-busy={rs?.kind === 'releasing'}
                          >
                            {rs?.kind === 'releasing' ? 'Dando de baja…' : 'Marcar baja'}
                          </button>
                        </div>
                        {rs?.kind === 'error' ? (
                          <p
                            className={styles.rowError}
                            role="alert"
                            aria-live="assertive"
                          >
                            {rs.message}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {invitePack ? (
        <InviteDialog
          organizationId={data.organizationId}
          pack={invitePack}
          onClose={onInviteClose}
        />
      ) : null}

      {nominalMember ? (
        <NominalProgressDialog
          organizationId={data.organizationId}
          member={nominalMember}
          onClose={() => setNominalMember(null)}
        />
      ) : null}
    </div>
  );
}
