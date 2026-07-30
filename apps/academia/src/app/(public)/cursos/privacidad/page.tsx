import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getLearnerSession } from '@/features/auth-learner/lib/session';
import { ConsentPanel } from '@/features/consent/components/ConsentPanel';
import type { Id } from '@zephyra/convex/_generated/dataModel';
import styles from './Privacy.module.css';

// force-dynamic: the learner session is a per-request read.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Privacidad de mi progreso — Zephyra',
};

/**
 * E6 — learner privacy preferences. Only an org-affiliated learner has an org to
 * share progress with, so we gate on a session that carries organizationId
 * (org_learner or org_admin). An individual learner has no org and is bounced to
 * the catalog. The org name is not a learner-readable field in the contract
 * (getMyOrganization is org-owner-gated), so the panel uses a generic label —
 * the learner already knows which org invited them.
 */
export default async function LearnerPrivacyPage() {
  const session = await getLearnerSession();
  if (!session) {
    redirect('/cursos/auth/signin?returnTo=/cursos/privacidad');
  }
  if (!session.organizationId) {
    redirect('/cursos');
  }

  return (
    <main className={styles.wrapper}>
      <div className={styles.header}>
        <Link href="/cursos" className={styles.backLink}>
          ← Volver a mis cursos
        </Link>
        <p className={styles.eyebrow}>Privacidad</p>
        <h1 className={styles.title}>Mi progreso y mi privacidad</h1>
      </div>
      <ConsentPanel
        learnerId={session.learnerId}
        organizationId={session.organizationId as Id<'lmsOrganizations'>}
        organizationName="tu organización"
      />
    </main>
  );
}
