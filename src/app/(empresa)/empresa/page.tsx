import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ConvexHttpClient } from 'convex/browser';
import { getLearnerSession } from '@/features/auth-learner/lib/session';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import styles from './Console.module.css';

// Owner-gated console. force-dynamic: the session + org read must be fresh per
// request (the session reflects the org_admin promotion right after sign-up).
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Mi empresa — Zephyra',
};

/**
 * E1 — minimal authenticated org console (3a spine). The full dashboard
 * (roster / seat assignment / progress) is 3b; for 3a this is an empty shell:
 * it confirms the org, shows "no packs yet", and points the owner at the B2B
 * catalog. Gated on the learner session being an org owner — a missing or
 * non-owner session is bounced to the empresa sign-in.
 */
export default async function EmpresaConsolePage() {
  const session = await getLearnerSession();
  if (!session || session.type !== 'org_admin') {
    redirect('/cursos/auth/signin?returnTo=/empresa');
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  // Self-scoped read (api-contract §1): only ever returns the org this caller
  // owns. A signed-in owner without an org row (edge) is sent back to sign-up.
  const org = await convex.query(api.lms.org.getOrganizationByOwner, {
    callerCustomerId: session.learnerId as Id<'lmsCustomers'>,
  });
  if (!org) {
    redirect('/empresa/registro');
  }

  return (
    <>
      <div className={styles.header}>
        <p className={styles.eyebrow}>Panel de empresa</p>
        <h1 className={styles.title}>{org.name}</h1>
        <p className={styles.subtitle}>
          Gestioná las compras de cursos para tu equipo.
        </p>
      </div>

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
    </>
  );
}
