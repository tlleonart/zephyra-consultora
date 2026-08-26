import type { Metadata } from "next";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@zephyra/convex/_generated/api";
import { CourseCard } from "@/components/public/CourseCard";
import { EmptyCoursesState } from "@/components/public/EmptyCoursesState";
import { toCourseCards } from "@/lib/course-catalog";
import { requireOrigin } from "@zephyra/utils";
import styles from "./CoursesPage.module.css";

// Server-rendered: the catalog SEO surface needs the document to ship with
// titles + cards in the HTML, not after a client hydrate. force-dynamic also
// makes admin publish state visible on the very next request — no redeploy,
// no stale ISR cache.
export const dynamic = "force-dynamic";

// SEO canonical / OpenGraph origin. This is ACADEMIA's own host
// (academia.zephyraconsultora.com); the PATH is unchanged — /cursos survives on
// this host verbatim (boundaries v1.1 §3.1 D1), only the host moves.
//
// The old `|| "https://zephyraconsultora.com"` was actively harmful post-split:
// served from the academia host it would tell crawlers the catalog's canonical
// home is the apex, i.e. hand academia's SEO to a host that does not serve
// /cursos. Module scope on purpose — `next build` then fails loudly in the
// Vercel project that forgot the variable, which is the cheapest place to
// discover it.
const SITE_URL = requireOrigin(
  "NEXT_PUBLIC_APP_URL",
  process.env.NEXT_PUBLIC_APP_URL
);

// T-06 (spec §2, AC 5): `/cursos?tema=<slug>` is a live filter, not a
// separate indexable page — its content is near-identical to the clean
// catalog for crawling purposes. A STATIC `metadata` export (rather than
// `generateMetadata`) applies to every request against this route
// regardless of query string, so the canonical below covers both
// `/cursos` and every `/cursos?tema=X` variant with the same declaration —
// there is no branch that could point a filtered URL at itself.
export const metadata: Metadata = {
  title: "Cursos",
  description:
    "Catálogo de cursos de Academia Zephyra. Formación en sostenibilidad, triple impacto y gestión del cambio para personas y organizaciones.",
  alternates: {
    canonical: `${SITE_URL}/cursos`,
  },
  openGraph: {
    title: "Cursos",
    description:
      "Catálogo de cursos de Academia Zephyra. Formación en sostenibilidad, triple impacto y gestión del cambio para personas y organizaciones.",
    type: "website",
    url: `${SITE_URL}/cursos`,
    images: [
      {
        url: `${SITE_URL}/images/hero-background.jpg`,
        alt: "Academia Zephyra — Cursos",
      },
    ],
  },
};

export default async function CursosPage({
  searchParams,
}: {
  searchParams: Promise<{ tema?: string }>;
}) {
  const { tema } = await searchParams;
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

  // T-06 (spec §2, §4.2): `?tema=<slug>` filters the same catalog by topic.
  // listPublishedByTopic validates the slug against the closed set itself
  // and returns [] for anything it doesn't recognise (stale/typo'd/
  // malicious `?tema=` values included) — that validation is NOT
  // reimplemented here (CONTRACT-TOPIC-FIELD-2026-08-26.md §6).
  const courses = tema
    ? await convex.query(api.lms.courses.listPublishedByTopic, { topic: tema })
    : await convex.query(api.lms.courses.listPublished, {});

  // Resolve cover URLs + descriptions in a single batched pass — no N+1.
  const cards = await toCourseCards(convex, courses);

  return (
    <>
      <section className={styles.hero}>
        <div className={styles.container}>
          <h1 className={styles.title}>Catálogo de cursos</h1>
          <p className={styles.subtitle}>
            Formaciones diseñadas para acompañar a personas y organizaciones en
            su camino hacia la sostenibilidad y el triple impacto. Elegí el
            curso que se ajuste a tu momento.
          </p>
        </div>
      </section>

      <section className={styles.content}>
        <div className={styles.container}>
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
    </>
  );
}
