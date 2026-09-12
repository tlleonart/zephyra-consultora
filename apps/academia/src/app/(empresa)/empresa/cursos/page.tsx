import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ConvexHttpClient } from 'convex/browser';
import { getLearnerSession } from '@/features/auth-learner/lib/session';
import { formatUsd } from '@/features/lms-checkout/lib/format-price';
import { api } from '@zephyra/convex/_generated/api';
import styles from './Catalog.module.css';

// Owner-gated B2B catalog. force-dynamic so a newly-published/priced course is
// visible on the next request (same strategy as the B2C catalog).
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Catálogo para equipos — Zephyra',
  description:
    'Comprá cursos para tu equipo con precios por volumen. Elegí un curso y calculá el precio según la cantidad de lugares.',
};

/**
 * E2 — B2B catalog over the same lmsCourses, B2B framing. Lists the courses
 * that are purchasable (published + isPurchasable + priced). Each card links to
 * the per-course pack page where the volume calculator lives. Owner-gated on
 * the learner session being an org owner.
 */
export default async function EmpresaCatalogPage() {
  const session = await getLearnerSession();
  // UAT1 / U3. Sin sesion se pide iniciar sesion, que es lo correcto. Pero con
  // una sesion viva que no es de duena, mandar a signin es mandar a una puerta
  // que ya se cruzo: el middleware la devuelve, y desde U2 la devuelve ACA,
  // con lo cual seria un bucle. Esa persona va a la propuesta publica.
  if (!session) {
    redirect('/cursos/auth/signin?returnTo=/empresa/cursos');
  }
  if (session.type !== 'org_admin') {
    redirect('/empresa');
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const courses = await convex.query(api.lms.courses.listPublished, {});

  const buyable = courses.filter(
    (c) =>
      c.isPurchasable === true &&
      typeof c.priceUsd === 'number' &&
      c.priceUsd > 0
  );

  return (
    <>
      <div className={styles.header}>
        <p className={styles.eyebrow}>Para equipos</p>
        <h1 className={styles.title}>Catálogo para equipos</h1>
        <p className={styles.subtitle}>
          Comprá cursos para tu equipo con precios por volumen. Elegí un curso y
          calculá el precio según la cantidad de lugares que necesites.
        </p>
      </div>

      {buyable.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            Próximamente vamos a habilitar cursos para equipos. Volvé pronto.
          </p>
        </div>
      ) : (
        <ul className={styles.grid} role="list">
          {buyable.map((c) => (
            <li key={c._id} className={styles.gridItem}>
              <Link href={`/empresa/cursos/${c.slug}`} className={styles.card}>
                <h2 className={styles.cardTitle}>{c.title}</h2>
                <p className={styles.cardMeta}>Precio por lugar (lista)</p>
                <p className={styles.cardPrice}>{formatUsd(c.priceUsd as number)}</p>
                <span className={styles.cardCta} aria-hidden="true">
                  Comprar para mi equipo →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
