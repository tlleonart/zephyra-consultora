/**
 * LMS — derivación de la POSICIÓN de la alumna en el curso (T-be-002).
 *
 * Módulo PURO: no importa nada de Convex. Lo consume la query de lectura
 * `lms/enrollments.ts:listMyCoursesWithProgress`, que es la que le da a
 * `/cursos/mis-cursos` el texto "Módulo 5 de 7 · en curso".
 *
 * ============================================================================
 * QUÉ ES ESTO Y QUÉ NO ES
 * ============================================================================
 *
 * NO es un porcentaje, y no va a serlo. Una fracción honesta NO es derivable
 * de los datos que el contenido emite: `cmi.suspend_data` trae la página
 * ACTUAL dentro de un SCO, nunca el TOTAL de páginas de ese SCO (medido sobre
 * 264 muestras reales — ver la caracterización en lms/suspendData.ts).
 * Estimar el total para sacar una fracción es el riesgo S9 de la spec:
 * produce un número que parece medido y está inventado. Acá se devuelve
 * POSICIÓN, que es lo que los datos sí sostienen.
 *
 * Tampoco toca `progressPercent`, `completedScoCount` ni `lessonStatus`. Por
 * decisión D-1 la señal se deriva en LECTURA: `convex/lms/scormEvents.ts` no
 * se modifica, no hay migración, no hay backfill, y el patch donde conviven
 * `firstTouchedAt` + `completedScoCount` + `progressPercent` —el único lugar
 * donde los invariantes de liberación de cupos podrían romperse— queda
 * intacto. Consecuencia aceptada: `progressPercent` sigue en 0 en la base y
 * el panel B2B sigue mostrando 0%. Eso es esperado, no un defecto.
 *
 * ============================================================================
 * LA REGLA DE DERIVACIÓN (hallazgo H-6)
 * ============================================================================
 *
 *   M (moduleTotal) = cantidad de ítems SCO de `course.scoStructure`, en el
 *                     orden del manifiesto (lms/scoStructure.ts). Para el
 *                     curso real publicado: 7.
 *
 *   N (moduleIndex) = posición 1-based, EN ESE MISMO ORDEN, del SCO más
 *                     avanzado que aparezca en `enrollment.scoStates`.
 *                     0 si no aparece ninguno.
 *
 * `actual` NO ENTRA EN EL NUMERADOR. Es el índice de página DENTRO de un SCO;
 * usarlo para numerar módulos repetiría exactamente el error que la spec
 * denuncia. A lo sumo distingue *tocado* de *no tocado* dentro del módulo
 * actual, y eso es lo único para lo que se usa acá (`moduleTouched`).
 *
 * POR QUÉ "el más avanzado presente" y no "cuántos hay": `scoStates` no es
 * contiguo. En los datos reales, la matrícula `zephyracs` tiene
 * ITEM_UNIDAD_01, ITEM_UNIDAD_03 e ITEM_RECURSOS — contar daría 3, cuando en
 * realidad ya llegó al último módulo del curso. La posición del más avanzado
 * es lo que responde "¿por dónde voy?", que es la pregunta de la pantalla.
 *
 * POR QUÉ ESTO SÍ SE MUEVE Y `done` NO (AC 18): la sola PRESENCIA de la clave
 * en `scoStates` ya prueba que la alumna abrió ese SCO — el reproductor
 * escribe la entrada en el primer `LMSSetValue`. Nati, con `done` vacío en el
 * 100% de sus muestras, tiene ITEM_PRESENTACION..ITEM_UNIDAD_04 en
 * `scoStates`, o sea "Módulo 5 de 7". Un criterio basado en `done` le daría
 * cero; éste no.
 *
 * BORDE QUE LOS DATOS YA MUESTRAN: `ITEM_PRESENTACION` aparece en la base SIN
 * `lessonStatus`, sólo con `suspendData`. La derivación NUNCA asume que la
 * clave existe.
 */

import { extractScoItems } from "./scoStructure";
import { parseSuspendData } from "./suspendData";

/**
 * Estado grueso del recorrido. Literales en inglés, como el resto de los
 * enums del schema (`active`/`completed`/`expired`, `incomplete`): la copia
 * en español ("· en curso") la arma la pantalla, no el backend.
 *
 * - `not-started` — no hay NINGÚN SCO en `scoStates`. Nunca abrió el curso.
 * - `in-progress` — abrió al menos un SCO y no están todos terminales.
 * - `completed`   — TODOS los SCOs declarados por el curso están terminales.
 */
export type CoursePositionState = "not-started" | "in-progress" | "completed";

export interface CoursePosition {
  /**
   * Posición 1-based del módulo más avanzado alcanzado. 0 si no empezó.
   * Nunca mayor que `moduleTotal`.
   */
  moduleIndex: number;
  /**
   * Cantidad de módulos (ítems SCO) que declara el curso. 0 si el curso no
   * tiene `scoStructure` — la pantalla tiene que aguantar ese caso sin
   * renderizar "Módulo 0 de 0".
   */
  moduleTotal: number;
  /**
   * Título del módulo en `moduleIndex`, tal como vino del manifiesto.
   * null si no empezó, si el ítem no declara título, o si no hay estructura.
   */
  moduleTitle: string | null;
  /** Ver CoursePositionState. */
  state: CoursePositionState;
  /**
   * ¿Hay evidencia de haberse movido DENTRO del módulo actual, más allá de su
   * primera página? Sale de `suspend_data` (`done` no vacío o `actual > 0`).
   * Es el único uso de `actual`, y es opcional para la pantalla: sirve para
   * matizar el sufijo ("recién empezado" vs "en curso") si se quiere.
   * false cuando no empezó.
   */
  moduleTouched: boolean;
}

/**
 * `lesson_status` que cuentan como SCO terminado. MISMO conjunto que
 * `TERMINAL_COMPLETE` en lms/scormEvents.ts, re-escrito en vez de importado
 * — misma convención de la casa que `TOPIC_SLUGS` en lms/courses.ts, que
 * re-deletrea los literales del schema en vez de importarlos. Importarlo
 * desde scormEvents.ts arrastraría `../_generated/server` a este módulo puro.
 */
const TERMINAL_COMPLETE = new Set(["completed", "passed"]);

/** La forma de `lmsEnrollments.scoStates` (schema.ts la declara `v.any()`). */
type ScoStateMapLike = Record<
  string,
  { lessonStatus?: string; suspendData?: string } | undefined
>;

const EMPTY_POSITION: CoursePosition = {
  moduleIndex: 0,
  moduleTotal: 0,
  moduleTitle: null,
  state: "not-started",
  moduleTouched: false,
};

/**
 * Deriva la posición de una matrícula. FUNCIÓN TOTAL: no lanza nunca, para
 * ningún par de entradas — `scoStates` y `scoStructure` son `v.any()` en el
 * schema, o sea que en runtime pueden ser cualquier cosa.
 *
 * @param scoStates    `lmsEnrollments.scoStates` crudo.
 * @param scoStructure `lmsCourses.scoStructure` crudo.
 */
export function deriveCoursePosition(
  scoStates: unknown,
  scoStructure: unknown
): CoursePosition {
  const items = extractScoItems(scoStructure);
  const moduleTotal = items.length;

  const states: ScoStateMapLike =
    scoStates && typeof scoStates === "object" && !Array.isArray(scoStates)
      ? (scoStates as ScoStateMapLike)
      : {};

  if (moduleTotal === 0) {
    // Curso sin estructura declarada (fixtures viejos, ingesta a medias). No
    // hay contra qué numerar: se devuelve lo mínimo honesto. `in-progress` si
    // hay estado, porque la alumna claramente entró a algo.
    const algo = Object.keys(states).length > 0;
    return {
      ...EMPTY_POSITION,
      state: algo ? "in-progress" : "not-started",
    };
  }

  // N = posición del SCO más avanzado PRESENTE en scoStates, en el orden del
  // manifiesto. Recorremos de atrás hacia adelante y cortamos en el primero.
  let lastIndex = -1;
  for (let i = moduleTotal - 1; i >= 0; i -= 1) {
    if (Object.prototype.hasOwnProperty.call(states, items[i].identifier)) {
      lastIndex = i;
      break;
    }
  }

  if (lastIndex < 0) {
    // Ningún SCO del curso aparece en scoStates. Ojo: `scoStates` PODRÍA
    // tener claves que no pertenecen a este curso (re-ingesta que cambió los
    // identificadores). No las contamos: el denominador manda.
    return { ...EMPTY_POSITION, moduleTotal };
  }

  // ¿Están TODOS los SCOs declarados en estado terminal? AC 19: nada dice
  // "completo" si alguno no lo está. Se barre la lista del CURSO, no las
  // claves de scoStates, justamente para que un SCO nunca abierto cuente
  // como no terminado. `lessonStatus` puede faltar (ITEM_PRESENTACION en los
  // datos reales) y eso ya es "no terminado".
  let allTerminal = true;
  for (const item of items) {
    const status = states[item.identifier]?.lessonStatus;
    if (!status || !TERMINAL_COMPLETE.has(status)) {
      allTerminal = false;
      break;
    }
  }

  const current = states[items[lastIndex].identifier];

  return {
    moduleIndex: lastIndex + 1,
    moduleTotal,
    moduleTitle: items[lastIndex].title,
    state: allTerminal ? "completed" : "in-progress",
    moduleTouched: parseSuspendData(current?.suspendData).advanced,
  };
}
