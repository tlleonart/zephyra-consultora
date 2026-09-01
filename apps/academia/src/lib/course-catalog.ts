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
 * Dos textos comparables: sin tildes, sin mayúsculas, sin puntuación de
 * borde y con los espacios colapsados. Sirve para una sola cosa — decidir si
 * dos cadenas dicen lo mismo — y no debe usarse para mostrar nada.
 */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    // U+0300..U+036F: los signos diacriticos que NFD deja sueltos.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * El título de la organización del manifiesto SCORM, cuando sirve como
 * descripción. `null` si no sirve.
 *
 * Está separado de `deriveDescriptionFromSco` porque las dos superficies
 * públicas comparten ESTA decisión (¿el paquete trae algo aprovechable?) pero
 * no la frase de reserva que usan cuando no trae nada. Antes eso se resolvía
 * comparando el texto devuelto contra una constante, que es exactamente el
 * tipo de acoplamiento que se rompe en silencio al editar una tilde.
 *
 * POR QUÉ COMPARA CONTRA EL TÍTULO DEL CURSO. Medido en staging el 2026-09-01:
 * el manifiesto del único curso publicado trae como título de organización
 * EXACTAMENTE el título del curso, así que la tarjeta del catálogo imprimía el
 * título dos veces seguidas y la ficha lo repetía bajo "Sobre este curso". El
 * guardarraíl de largo (> 12) no lo veía porque el texto es largo: el problema
 * no es que sea corto, es que es el mismo. Un empaquetador SCORM que nombra la
 * organización igual que el curso es lo normal, no la excepción, así que esto
 * va a pasar con cada curso que se ingeste sin descripción escrita.
 *
 * La solución de fondo no es ésta: es que Zephyra escriba la descripción en el
 * panel. Esto sólo evita que el hueco de contenido se vea como un defecto.
 */
export function scoOrgTitle(
  scoStructure: unknown,
  courseTitle?: string
): string | null {
  const s = (scoStructure ?? {}) as ScoStructure;
  const orgTitle = s.organizations?.title?.trim();
  if (!orgTitle || orgTitle.length <= 12) return null;
  if (courseTitle && normalizar(orgTitle) === normalizar(courseTitle)) {
    return null;
  }
  return orgTitle;
}

export function deriveDescriptionFromSco(
  scoStructure: unknown,
  courseTitle?: string
): string {
  return (
    scoOrgTitle(scoStructure, courseTitle) ??
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
  title?: string;
  description?: string;
  scoStructure?: unknown;
}): string {
  if (course.description) {
    const plain = stripHtmlToText(course.description);
    if (plain.length > 0) return plain;
  }
  return deriveDescriptionFromSco(course.scoStructure, course.title);
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
