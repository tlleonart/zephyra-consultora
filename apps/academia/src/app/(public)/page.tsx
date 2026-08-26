import type { Metadata } from "next";
import Link from "next/link";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@zephyra/convex/_generated/api";
import { CourseCard } from "@/components/public/CourseCard";
import { EmptyCoursesState } from "@/components/public/EmptyCoursesState";
import { toCourseCards } from "@/lib/course-catalog";
import { btnClass } from "@zephyra/ui";
import { LMS_TOPIC_LABELS, requireOrigin } from "@zephyra/utils";
import styles from "./Home.module.css";

// Same rationale as the catalog (see (public)/cursos/page.tsx): the home is
// the SEO entry point for the whole app, and it must reflect admin publish
// state (a newly-published course, a newly-assigned topic) on the very next
// request — no redeploy, no stale ISR cache.
export const dynamic = "force-dynamic";

const SITE_URL = requireOrigin(
  "NEXT_PUBLIC_APP_URL",
  process.env.NEXT_PUBLIC_APP_URL
);

const HOME_DESCRIPTION =
  "Formación en diversidad, equidad, inclusión y sostenibilidad para personas y organizaciones, con una experiencia cálida y cercana.";

export const metadata: Metadata = {
  title: "Inicio",
  description: HOME_DESCRIPTION,
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: "Academia Zephyra",
    description: HOME_DESCRIPTION,
    type: "website",
    url: SITE_URL,
    images: [
      {
        url: `${SITE_URL}/images/hero-background.jpg`,
        alt: "Academia Zephyra",
      },
    ],
  },
};

// Spec §3.3: "hasta 6 cursos publicados, ordenados por fecha de publicación
// descendente". `lmsCourses` carries no `publishedAt` — schema.ts's time
// fields are `createdAt`, `updatedAt` and `archivedAt` only, and the T-04
// schema contract (CONTRACT-TOPIC-FIELD-2026-08-26.md) is frozen: widening
// it is a new contract, not this task. `updatedAt` is the most honest proxy
// available — it is the one field every publish transition actually
// touches (`setStatus` patches it on every status change, lms/courses.ts),
// where `createdAt` would instead reflect ingest time, which can predate
// publish by an arbitrary amount and never moves on a republish. The known
// trade-off, flagged rather than resolved in silence: a pure metadata edit
// (`updateCourseMeta`, e.g. fixing a typo in the title) also bumps
// `updatedAt` without a new publish, so the home's order can shift on an
// edit that is not a (re)publish. With 2 published courses today this is
// not visible; it becomes worth a real `publishedAt` field only once
// ordering among several courses actually matters to Zephyra.
const MAX_HOME_COURSES = 6;

export default async function HomePage() {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

  const [allPublished, topicsWithCourses] = await Promise.all([
    convex.query(api.lms.courses.listPublished, {}),
    // spec §3.2 / AC 4: only topics with >=1 published course render a
    // chip. listPublishedTopics already does that reduction server-side —
    // this page does not re-derive it from allPublished.
    convex.query(api.lms.courses.listPublishedTopics, {}),
  ]);

  const homeCourses = [...allPublished]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_HOME_COURSES);
  const cards = await toCourseCards(convex, homeCourses);
  const hasMoreCourses = allPublished.length > MAX_HOME_COURSES;

  // Chip order follows the taxonomy's canonical order (the key order in
  // @zephyra/utils's LMS_TOPIC_LABELS, pinned to schema.ts by
  // apps/backoffice/tests/unit/shared/lmsTopicTaxonomy.test.ts), not
  // whatever order Convex happens to return — that order is a Set built
  // from a `.collect()` scan and is not a UI contract.
  const topicSlugSet = new Set<string>(topicsWithCourses);
  const topicSlugs = Object.keys(LMS_TOPIC_LABELS).filter((slug) =>
    topicSlugSet.has(slug)
  );

  return (
    <>
      <section className={styles.hero}>
        <div className={styles.container}>
          <span className={styles.eyebrow}>Formación con triple impacto</span>
          <h1 className={styles.title}>
            Aprender es el primer paso del cambio
          </h1>
          <p className={styles.lead}>
            Cursos de diversidad, equidad, inclusión y sostenibilidad, con
            una experiencia cálida y cercana para vos y tu equipo.
          </p>
          <div className={styles.actions}>
            <Link
              href="/cursos"
              className={btnClass({ size: "lg", variant: "inverse" })}
            >
              Explorá el catálogo
            </Link>
            <Link href="/empresa" className={styles.secondaryAction}>
              Para tu organización
            </Link>
          </div>
        </div>
      </section>

      {/* spec §3.2, AC 4: a topic with zero published courses renders no
          chip; if NONE has a course, the whole section is skipped — there
          is no empty state for it. */}
      {topicSlugs.length > 0 ? (
        <section className={styles.topics}>
          <div className={styles.container}>
            <h2 className={styles.sectionTitle}>Explorá por temática</h2>
            <p className={styles.sectionSubtitle}>
              Elegí un recorrido para vos o para tu equipo.
            </p>
            <ul className={styles.chips} role="list">
              {topicSlugs.map((slug) => (
                <li key={slug}>
                  <Link
                    href={`/cursos?tema=${slug}`}
                    className={styles.chip}
                  >
                    {LMS_TOPIC_LABELS[slug]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section className={styles.courses}>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <div>
              <h2 className={styles.sectionTitle}>Cursos</h2>
              <p className={styles.sectionSubtitle}>
                Formaciones listas para empezar hoy.
              </p>
            </div>
            {hasMoreCourses ? (
              <Link href="/cursos" className={styles.viewAll}>
                Ver todos →
              </Link>
            ) : null}
          </div>
          {cards.length === 0 ? (
            <EmptyCoursesState />
          ) : (
            <ul className={styles.grid} role="list">
              {cards.map((c) => (
                <li key={c.slug} className={styles.gridItem}>
                  <CourseCard {...c} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className={styles.bandSection}>
        <div className={styles.container}>
          <div className={styles.band}>
            <span className={styles.bandEyebrow}>Para organizaciones</span>
            <h2 className={styles.bandTitle}>
              Formá a tu equipo con packs a medida
            </h2>
            <p className={styles.bandText}>
              Sumá cupos para tu equipo y seguí el avance desde un panel de
              organización. Elegí el pack que se ajuste a tu presupuesto
              desde la ficha de cada curso.
            </p>
            <Link
              href="/empresa"
              className={btnClass({ size: "lg", variant: "inverse" })}
            >
              Conocé la propuesta B2B
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
