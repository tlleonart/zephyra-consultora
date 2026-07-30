import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ConvexHttpClient } from 'convex/browser';
import { getLearnerSession } from '@/features/auth-learner/lib/session';
import { OrgDashboard } from '@/features/org-dashboard/components/OrgDashboard';
import type { OrgDashboardData } from '@/features/org-dashboard/types';
import { api } from '@zephyra/convex/_generated/api';
import type { Id } from '@zephyra/convex/_generated/dataModel';
import styles from './Console.module.css';

// Owner-gated dashboard. force-dynamic: every owner-scoped read (roster /
// seat-packs / aggregate) must be fresh per request.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Mi empresa — Zephyra',
};

/**
 * E5 — Org-Admin dashboard (replaces the 3a shell). Gated on the learner session
 * being an org owner. Server-fetches the owner-scoped reads (api-contract §D1):
 *   - getOrgSeatPacks  → pack cards (total / asignados / disponibles)
 *   - getOrgRoster     → members (display email only — membership ≠ progress)
 *   - getOrgCourseProgress → aggregate progress per course (no identities)
 * Course titles are joined client-side from listPublished on courseId (the
 * admin-gated getById is off-limits). All identity-bearing interactions (invite,
 * release, nominal drill-down) run through gated server actions in OrgDashboard.
 *
 * Empty state: a freshly-signed-up owner with no paid pack yet sees the upsell
 * to the B2B catalog (the 3a empty shell, preserved as the zero-pack branch).
 */
export default async function EmpresaDashboardPage() {
  const session = await getLearnerSession();
  if (!session || session.type !== 'org_admin') {
    redirect('/cursos/auth/signin?returnTo=/empresa');
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const callerCustomerId = session.learnerId as Id<'lmsCustomers'>;

  const org = await convex.query(api.lms.org.getOrganizationByOwner, {
    callerCustomerId,
  });
  if (!org) {
    redirect('/empresa/registro');
  }
  const organizationId = org._id;

  // Owner-scoped reads. getOrgSeatPacks / getOrgRoster / getOrgCourseProgress are
  // all requireOrgOwner-gated; the callerCustomerId is the verified session id.
  const [packsRes, rosterRes, progressRes, courses] = await Promise.all([
    convex.query(api.lms.seats.getOrgSeatPacks, { callerCustomerId, organizationId }),
    convex.query(api.lms.seats.getOrgRoster, { callerCustomerId, organizationId }),
    convex.query(api.lms.seats.getOrgCourseProgress, { callerCustomerId, organizationId }),
    convex.query(api.lms.courses.listPublished, {}),
  ]);

  // courseId → title (display join, client-side per the contract).
  const titleByCourse = new Map<string, string>(
    courses.map((c) => [c._id as string, c.title])
  );
  const slugByCourse = new Map<string, string>(
    courses.map((c) => [c._id as string, c.slug])
  );

  const data: OrgDashboardData = {
    organizationId: organizationId as string,
    organizationName: org.name,
    packs: packsRes.packs.map((p) => ({
      seatPackId: p.seatPackId as string,
      courseId: p.courseId as string,
      courseTitle: titleByCourse.get(p.courseId as string) ?? 'Curso',
      courseSlug: slugByCourse.get(p.courseId as string),
      totalSeats: p.totalSeats,
      claimedSeats: p.claimedSeats,
      availableSeats: p.availableSeats,
    })),
    members: rosterRes.members.map((m) => ({
      learnerId: m.learnerId as string,
      email: m.email,
      courseId: m.courseId as string,
      courseTitle: titleByCourse.get(m.courseId as string) ?? 'Curso',
      seatId: m.seatId as string,
      claimedAt: m.claimedAt,
    })),
    progress: progressRes.courses.map((c) => ({
      courseId: c.courseId as string,
      courseTitle: titleByCourse.get(c.courseId as string) ?? 'Curso',
      totalClaimed: c.totalClaimed,
      completed: c.completed,
      inProgress: c.inProgress,
      notStarted: c.notStarted,
      avgProgressPercent: c.avgProgressPercent,
    })),
  };

  const hasPacks = data.packs.length > 0;

  return (
    <>
      <div className={styles.header}>
        <p className={styles.eyebrow}>Panel de empresa</p>
        <h1 className={styles.title}>{org.name}</h1>
        <p className={styles.subtitle}>
          Gestioná los cursos, los lugares y el avance de tu equipo.
        </p>
      </div>

      {hasPacks ? (
        <OrgDashboard data={data} />
      ) : (
        <section className={styles.empty} aria-labelledby="empty-title">
          <span className={styles.emptyIcon} aria-hidden="true">
            ✦
          </span>
          <h2 id="empty-title" className={styles.emptyTitle}>
            Todavía no compraste packs
          </h2>
          <p className={styles.emptyText}>
            Elegí un curso del catálogo y comprá la cantidad de lugares que
            necesites para tu equipo. Cuanto mayor el volumen, mejor el precio por
            lugar. Después vas a poder asignar los lugares a tu equipo desde acá.
          </p>
          <Link href="/empresa/cursos" className={styles.cta}>
            Ver el catálogo para equipos
          </Link>
        </section>
      )}
    </>
  );
}
