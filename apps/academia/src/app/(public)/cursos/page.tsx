import type { Metadata } from "next";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@zephyra/convex/_generated/api";
import { CourseCard, type CourseCardData } from "@/components/public/CourseCard";
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

export const metadata: Metadata = {
  title: "Cursos",
  description:
    "Catálogo de cursos de Academia Zephyra. Formación en sostenibilidad, triple impacto y gestión del cambio para personas y organizaciones.",
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

type ScoStructure = {
  organizations?: {
    title?: string;
    items?: {
      identifier: string;
      identifierref: string | null;
      title: string;
    }[];
  };
  resources?: {
    identifier: string;
    href: string | null;
    scormType: string | null;
  }[];
};

function deriveDescription(scoStructure: unknown): string {
  const s = (scoStructure ?? {}) as ScoStructure;
  const orgTitle = s.organizations?.title?.trim();
  if (orgTitle && orgTitle.length > 12) return orgTitle;
  return "Formación online a tu ritmo. Contenidos prácticos y aplicables.";
}

function deriveScoCount(scoStructure: unknown): number {
  const s = (scoStructure ?? {}) as ScoStructure;
  const items = s.organizations?.items ?? [];
  const resources = s.resources ?? [];
  return items.filter((it) => {
    const res = resources.find((r) => r.identifier === it.identifierref);
    if (!res) return false;
    return res.scormType === "sco" || res.scormType === null;
  }).length;
}

export default async function CursosPage() {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const courses = await convex.query(api.lms.courses.listPublished, {});

  // Resolve cover URLs in a single batched pass (parallel awaits) — no N+1.
  // The schema does not yet carry `coverStorageId` on lmsCourses, but the
  // optional access here is future-proofed for when ingestion populates it.
  const cards: CourseCardData[] = await Promise.all(
    courses.map(async (course) => {
      const maybeCoverId = (course as unknown as { coverStorageId?: string })
        .coverStorageId;
      let coverUrl: string | null = null;
      if (maybeCoverId) {
        coverUrl = await convex.query(api.files.getUrl, {
          storageId: maybeCoverId as never,
        });
      }
      return {
        slug: course.slug,
        title: course.title,
        description: deriveDescription(course.scoStructure),
        scoCount: deriveScoCount(course.scoStructure),
        coverUrl,
      };
    })
  );

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
            <div className={styles.empty}>
              <span className={styles.emptyIcon} aria-hidden="true">
                ✦
              </span>
              <p className={styles.emptyText}>
                Próximamente nuevos cursos. Estamos preparando contenidos para
                acompañarte. Volvé pronto.
              </p>
            </div>
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
