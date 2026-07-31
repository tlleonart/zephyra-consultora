import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ConvexHttpClient } from "convex/browser";
import { getLearnerSession } from "@/features/auth-learner/lib/session";
import { BuyButton } from "@/features/lms-checkout/components/BuyButton";
import { formatUsd } from "@/features/lms-checkout/lib/format-price";
import { api } from "@zephyra/convex/_generated/api";
import { btnClass } from "@zephyra/ui";
import { requireOrigin } from "@zephyra/utils";
import styles from "./CourseDetail.module.css";

// Same rendering strategy as the catalog: SEO + share previews need the
// per-course metadata to ship server-side so OpenGraph crawlers see it.
export const dynamic = "force-dynamic";

// Same rule as the catalog: ACADEMIA's own origin, path unchanged
// (/cursos/[slug]) per boundaries v1.1 §3.1 D1. See ../page.tsx for why the apex
// fallback was removed rather than repointed.
const SITE_URL = requireOrigin(
  "NEXT_PUBLIC_APP_URL",
  process.env.NEXT_PUBLIC_APP_URL
);

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

function deriveDescription(course: { title: string; scoStructure?: unknown }): string {
  const s = (course.scoStructure ?? {}) as ScoStructure;
  const orgTitle = s.organizations?.title?.trim();
  if (orgTitle && orgTitle.length > 12) return orgTitle;
  return `${course.title}. Formación online a tu ritmo, con contenidos prácticos y aplicables al día a día profesional.`;
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

async function fetchCourseForRender(slug: string) {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  // getBySlug is PUBLIC and already filters status:"published"; a draft slug
  // returns null here, which we map to notFound() — no draft leak.
  const course = await convex.query(api.lms.courses.getBySlug, { slug });
  if (!course) return null;

  const maybeCoverId = (course as unknown as { coverStorageId?: string })
    .coverStorageId;
  let coverUrl: string | null = null;
  if (maybeCoverId) {
    coverUrl = await convex.query(api.files.getUrl, {
      storageId: maybeCoverId as never,
    });
  }

  return { course, coverUrl, convex };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await fetchCourseForRender(slug);
  if (!result) {
    return {
      title: "Curso no encontrado",
      description: "El curso que buscás no existe o no está disponible.",
    };
  }
  const { course, coverUrl } = result;
  const description = deriveDescription(course).slice(0, 160);
  const url = `${SITE_URL}/cursos/${course.slug}`;

  return {
    title: `${course.title}`,
    description,
    openGraph: {
      title: `${course.title}`,
      description,
      type: "article",
      url,
      images: coverUrl
        ? [{ url: coverUrl, alt: course.title }]
        : [
            {
              url: `${SITE_URL}/images/hero-background.jpg`,
              alt: course.title,
            },
          ],
    },
  };
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await fetchCourseForRender(slug);
  if (!result) notFound();
  const { course, coverUrl, convex } = result;

  // Learner-aware CTA: a signed-in learner with an active enrollment for this
  // exact course gets a live "Ir al curso" link to the player. Anyone else
  // sees the disabled Sprint-1 stub. Doing this check server-side keeps the
  // CTA correct in the SSR HTML (no flash) and avoids leaking enrollment
  // state into client bundles.
  const session = await getLearnerSession();
  let hasEnrollment = false;
  let isSignedIn = false;
  if (session) {
    isSignedIn = true;
    const enrollment = await convex.query(api.lms.enrollments.getMyEnrollment, {
      learnerId: session.learnerId,
      courseId: course._id,
    });
    hasEnrollment = enrollment !== null;
  }

  const description = deriveDescription(course);
  const scoCount = deriveScoCount(course.scoStructure);
  const scoLabel = scoCount === 1 ? "1 módulo" : `${scoCount} módulos`;

  // Pricing surface (Sprint 2 P1.5). A course is buyable only when it is
  // explicitly purchasable AND carries a positive USD price. Anything else
  // falls back to the "próximamente" stub so an un-priced course never exposes
  // a buy path. The price + CTA state are computed server-side so the SSR HTML
  // is correct (no flash) and enrollment state never leaks into client bundles.
  const priceUsd =
    typeof course.priceUsd === "number" ? course.priceUsd : null;
  const isBuyable =
    course.isPurchasable === true && priceUsd !== null && priceUsd > 0;

  return (
    <article>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroText}>
            <Link href="/cursos" className={styles.backLink}>
              ← Volver al catálogo
            </Link>
            <h1 className={styles.title}>{course.title}</h1>
            {scoCount > 0 ? (
              <p className={styles.scoCount}>{scoLabel}</p>
            ) : null}
          </div>
          <div className={styles.heroImage}>
            {coverUrl ? (
              <Image
                src={coverUrl}
                alt={course.title}
                fill
                priority
                className={styles.coverImage}
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            ) : (
              <div className={styles.coverPlaceholder} aria-hidden="true">
                <span className={styles.coverPlaceholderIcon}>◆</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={styles.body}>
        <div className={styles.bodyInner}>
          <div className={styles.bodyMain}>
            <h2 className={styles.sectionTitle}>Sobre este curso</h2>
            <div className={styles.description}>
              {description.split(/\n+/).map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </div>

          <aside className={styles.purchasePanel} aria-label="Inscripción">
            {isBuyable && priceUsd !== null ? (
              <p className={styles.price}>
                <span className={styles.priceAmount}>
                  {formatUsd(priceUsd)}
                </span>
                <span className={styles.priceNote}>Pago único</span>
              </p>
            ) : null}

            {hasEnrollment ? (
              // State 1: signed-in + already enrolled → go to the player.
              <>
                <Link
                  href={`/cursos/${course.slug}/player`}
                  className={btnClass({ size: "lg", block: true })}
                >
                  Ir al curso
                </Link>
                <p className={styles.ctaHelp}>
                  Ya tenés acceso a este curso. Retomá donde lo dejaste.
                </p>
              </>
            ) : !isBuyable ? (
              // Fallback: course not yet priced/purchasable.
              <>
                <button
                  type="button"
                  className={btnClass({
                    size: "lg",
                    block: true,
                    className: styles.ctaUnavailable,
                  })}
                  disabled
                  aria-disabled="true"
                >
                  Próximamente
                </button>
                <p className={styles.ctaHelp}>
                  La compra del curso estará disponible próximamente.
                </p>
                {isSignedIn ? (
                  <p className={styles.ctaNote}>
                    Esta cuenta no tiene acceso a este curso todavía.
                  </p>
                ) : null}
              </>
            ) : isSignedIn ? (
              // State 3: signed-in + not enrolled → buy.
              <>
                <BuyButton
                  courseId={course._id}
                  className={btnClass({ size: "lg", block: true })}
                />
                <p className={styles.ctaHelp}>
                  Comprá el curso y obtené acceso inmediato al contenido.
                </p>
              </>
            ) : (
              // State 2: anonymous → sign in to buy (returnTo preserves intent).
              <>
                <Link
                  href={`/cursos/auth/signin?returnTo=${encodeURIComponent(
                    `/cursos/${course.slug}`
                  )}`}
                  className={btnClass({ size: "lg", block: true })}
                >
                  Iniciá sesión para comprar
                </Link>
                <p className={styles.ctaHelp}>
                  Necesitás una cuenta para comprar este curso. Es gratis y
                  toma menos de un minuto.
                </p>
              </>
            )}
          </aside>
        </div>
      </section>
    </article>
  );
}
