/**
 * Shared card-assembly logic for the public course surfaces (`/cursos` and
 * `/`, T-06/T-07, M-HOME). Both pages fetch a list of published
 * `lmsCourses` docs and turn each one into a `CourseCardData` the same way
 * (resolve the cover URL, resolve the description, count SCOs) — this
 * module is the single place that does it, so the two call sites cannot
 * drift the way `deriveDescription` almost did when only one of them got
 * the T-07 fix.
 */
import type { ConvexHttpClient } from "convex/browser";
import { api } from "@zephyra/convex/_generated/api";
import type { Doc } from "@zephyra/convex/_generated/dataModel";
import type { CourseCardData } from "@/components/public/CourseCard";
import { stripHtmlToText, stripHtmlToParagraphs } from "@/lib/strip-html";

export type ScoStructure = {
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

/** The subset of `lmsCourses` every card-assembly helper below needs. */
export type PublishedCourse = Pick<
  Doc<"lmsCourses">,
  "slug" | "title" | "description" | "scoStructure" | "coverStorageId"
>;

/**
 * El título de la organización del manifiesto SCORM, cuando tiene cuerpo
 * suficiente para hacer de descripción. `null` si no lo tiene.
 *
 * Está separado de `deriveDescriptionFromSco` porque las dos superficies
 * públicas comparten ESTA decisión (¿el paquete trae algo aprovechable?) pero
 * no la frase de reserva que usan cuando no trae nada. Antes eso se resolvía
 * comparando el texto devuelto contra una constante, que es exactamente el
 * tipo de acoplamiento que se rompe en silencio al editar una tilde.
 */
export function scoOrgTitle(scoStructure: unknown): string | null {
  const s = (scoStructure ?? {}) as ScoStructure;
  const orgTitle = s.organizations?.title?.trim();
  return orgTitle && orgTitle.length > 12 ? orgTitle : null;
}

export function deriveDescriptionFromSco(scoStructure: unknown): string {
  return (
    scoOrgTitle(scoStructure) ??
    "Formación online a tu ritmo. Contenidos prácticos y aplicables."
  );
}

/**
 * T-07: use the panel's written description when there is one — stripped
 * to plain text, since it is rich-text HTML and CourseCard renders it via
 * plain JSX interpolation — falling back to the SCO-derived stand-in for
 * courses that predate the field or were left blank.
 */
export function resolveCourseDescription(course: {
  description?: string;
  scoStructure?: unknown;
}): string {
  if (course.description) {
    const plain = stripHtmlToText(course.description);
    if (plain.length > 0) return plain;
  }
  return deriveDescriptionFromSco(course.scoStructure);
}

/**
 * P-10: the same rule as the card, for the course DETAIL body, which renders
 * the description as real paragraphs instead of a one-line excerpt.
 *
 * Returns an EMPTY array when there is no written description, instead of
 * falling back here. The two surfaces need different stand-ins — the card's
 * omits the course title because the card already shows it right above,
 * the detail page's leads with it — so the fallback stays with the caller
 * and only the "use what the admin wrote" half is shared.
 */
export function resolveCourseDescriptionParagraphs(course: {
  description?: string;
}): string[] {
  if (!course.description) return [];
  return stripHtmlToParagraphs(course.description);
}

export function deriveScoCount(scoStructure: unknown): number {
  const s = (scoStructure ?? {}) as ScoStructure;
  const items = s.organizations?.items ?? [];
  const resources = s.resources ?? [];
  return items.filter((it) => {
    const res = resources.find((r) => r.identifier === it.identifierref);
    if (!res) return false;
    return res.scormType === "sco" || res.scormType === null;
  }).length;
}

async function resolveCoverUrl(
  convex: ConvexHttpClient,
  coverStorageId: string | undefined
): Promise<string | null> {
  if (!coverStorageId) return null;
  return await convex.query(api.files.getUrl, {
    storageId: coverStorageId as never,
  });
}

/** One course doc -> one `CourseCardData`, cover URL included. */
export async function toCourseCardData(
  convex: ConvexHttpClient,
  course: PublishedCourse
): Promise<CourseCardData> {
  const coverUrl = await resolveCoverUrl(convex, course.coverStorageId);
  return {
    slug: course.slug,
    title: course.title,
    description: resolveCourseDescription(course),
    scoCount: deriveScoCount(course.scoStructure),
    coverUrl,
  };
}

/** A batch of course docs -> `CourseCardData[]`, in parallel — no N+1. */
export async function toCourseCards(
  convex: ConvexHttpClient,
  courses: PublishedCourse[]
): Promise<CourseCardData[]> {
  return await Promise.all(courses.map((c) => toCourseCardData(convex, c)));
}
