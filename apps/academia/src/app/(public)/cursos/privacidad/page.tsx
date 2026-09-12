import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getLearnerSession } from '@/features/auth-learner/lib/session';
import { ConsentPanel } from '@/features/consent/components/ConsentPanel';
import { LearnerDataPanel } from '@/features/privacy/components/LearnerDataPanel';
import type { Id } from '@zephyra/convex/_generated/dataModel';
import styles from './Privacy.module.css';

// force-dynamic: the learner session is a per-request read.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Privacidad de mi progreso — Zephyra',
};

/**
 * E6 — preferencias de privacidad de la alumna. DOS RAMAS desde UAT1 / U4.
 *
 * CON ORGANIZACION: el panel de consentimiento de siempre, intacto. Solo una
 * alumna afiliada a una empresa tiene con quien compartir su avance, asi que
 * ese panel sigue gateado en que la sesion traiga `organizationId`. El nombre
 * de la organizacion no es un campo legible por la alumna en el contrato
 * (getMyOrganization esta gateado a la duena), asi que el panel usa una
 * etiqueta generica — ella ya sabe quien la invito.
 *
 * SIN ORGANIZACION: su propia pantalla de datos. ANTES REBOTABA AL CATALOGO, y
 * ese rebote es lo que reportaron las testers por los dos accesos que llevan
 * aca: el enlace del menu de cuenta y el del encabezado del reproductor. Los
 * dos ofrecian la puerta sin condicion y la puerta devolvia al catalogo.
 *
 * El rebote era deliberado y estaba anotado como decision diferida en
 * `account-menu-links.ts`: "seria decidir por producto que una alumna sin
 * empresa no tiene superficie de derechos de datos. Esa decision no se toma
 * desde aca". Se tomo el 2026-09-12 (Tomas): la alumna B2C tiene pantalla.
 */
export default async function LearnerPrivacyPage() {
  const session = await getLearnerSession();
  if (!session) {
    redirect('/cursos/auth/signin?returnTo=/cursos/privacidad');
  }
  return (
    <main className={styles.wrapper}>
      <div className={styles.header}>
        <Link href="/cursos" className={styles.backLink}>
          ← Volver a mis cursos
        </Link>
        <p className={styles.eyebrow}>Privacidad</p>
        <h1 className={styles.title}>
          {session.organizationId
            ? 'Mi progreso y mi privacidad'
            : 'Mis datos y mi privacidad'}
        </h1>
      </div>
      {session.organizationId ? (
        <ConsentPanel
          learnerId={session.learnerId}
          organizationId={session.organizationId as Id<'lmsOrganizations'>}
          organizationName="tu organización"
        />
      ) : (
        <LearnerDataPanel email={session.email} />
      )}
    </main>
  );
}
