/**
 * LMS — lectura de `lmsCourses.scoStructure` (T-be-002).
 *
 * Módulo PURO: no importa nada de Convex.
 *
 * POR QUÉ EXISTE: `extractScoIds` vivía privada dentro de
 * convex/lms/scormEvents.ts, donde la usa la re-derivación de
 * `completedScoCount`/`progressPercent`. La derivación de posición que ve la
 * alumna (lms/coursePosition.ts) necesita EXACTAMENTE la misma lista, en el
 * mismo orden: si las dos divergieran, el "de 7" que ve la alumna y el
 * denominador del porcentaje del panel B2B hablarían de cursos distintos.
 * Así que se movió acá y ahora hay un solo origen.
 *
 * El movimiento es una extracción, no un cambio: `scormEvents.ts` sólo
 * cambió el import (decisión D-1 — ese archivo no se toca más allá de eso).
 * `extractScoIds` conserva su semántica al detalle, incluida la de tratar
 * `scormType` ausente o null como "sco".
 */

/** Un ítem de la organización, ya filtrado a los que son SCO navegables. */
export interface ScoItem {
  /** `identifier` del <item>. Es la clave de `lmsEnrollments.scoStates`. */
  identifier: string;
  /** `title` del <item>, tal como vino del imsmanifest.xml. Puede faltar. */
  title: string | null;
}

interface ScoStructureShape {
  organizations?: {
    items?: Array<{
      identifier?: string;
      identifierref?: string | null;
      title?: string | null;
    }>;
  };
  resources?: Array<{ identifier?: string; scormType?: string | null }>;
}

/**
 * Los ítems SCO de un curso, EN EL ORDEN DEL MANIFIESTO. Ese orden es el
 * contrato: es el que recorre el reproductor y el que numera "Módulo N de M".
 *
 * Mirrors the manifest parser: each <item> with an identifierref pointing to
 * a "sco" resource counts as one SCO. WHY use item identifiers (not resource
 * identifiers): items are what the player navigates between, and one resource
 * CAN be referenced by multiple items (rare but legal in IMS CP). The 1:1
 * player-nav-to-progress mapping requires item-level identity.
 */
export function extractScoItems(scoStructure: unknown): ScoItem[] {
  if (!scoStructure || typeof scoStructure !== "object") return [];
  const s = scoStructure as ScoStructureShape;
  const items = s.organizations?.items ?? [];
  const resources = s.resources ?? [];
  const scoResourceIds = new Set(
    resources
      .filter((r) => (r.scormType ?? "sco") === "sco")
      .map((r) => r.identifier)
      .filter((x): x is string => typeof x === "string" && x.length > 0)
  );
  const out: ScoItem[] = [];
  for (const it of items) {
    if (!it.identifier || !it.identifierref) continue;
    if (scoResourceIds.has(it.identifierref)) {
      out.push({
        identifier: it.identifier,
        title: typeof it.title === "string" ? it.title : null,
      });
    }
  }
  return out;
}

/**
 * Pull the ordered list of SCO identifiers from a parsed course's
 * scoStructure. Proyección de `extractScoItems` — misma lista, mismo orden,
 * sólo los identificadores. Es la que consume scormEvents.ts para el
 * denominador de `progressPercent` y el barrido de `lessonStatus`.
 */
export function extractScoIds(scoStructure: unknown): string[] {
  return extractScoItems(scoStructure).map((it) => it.identifier);
}
