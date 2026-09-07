/**
 * LMS — derivación del AVANCE que ve la alumna (T-be-002 / T-be-002b).
 *
 * Módulo PURO: no importa nada de Convex. Lo consume la query de lectura
 * `lms/enrollments.ts:listMyCoursesWithProgress`, que es la que le da a
 * `/cursos/mis-cursos` el texto "5 de 7 módulos vistos".
 *
 * ============================================================================
 * QUÉ ES ESTO Y QUÉ NO ES
 * ============================================================================
 *
 * NO es un porcentaje, y no va a serlo. Una fracción de PROGRESO honesta no es
 * derivable de los datos que el contenido emite: `cmi.suspend_data` trae la
 * página ACTUAL dentro de un SCO, nunca el TOTAL de páginas de ese SCO
 * (medido sobre 264 muestras reales — ver la caracterización en
 * lms/suspendData.ts). Estimar el total para sacar una fracción es el riesgo
 * S9 de la spec: produce un número que parece medido y está inventado.
 *
 * Lo que sí se devuelve es un CONTEO sobre un total conocido: cuántos módulos
 * vio, de cuántos tiene el curso. Los dos números están medidos. La copia de
 * la pantalla dice "5 de 7 módulos vistos", NUNCA "71%": la diferencia no es
 * de estilo — un porcentaje se lee como "avance del curso" y esto no lo es.
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
 * LA REGLA DE DERIVACIÓN
 * ============================================================================
 *
 *   M (moduleTotal)  = cantidad de ítems SCO de `course.scoStructure`, en el
 *                      orden del manifiesto (lms/scoStructure.ts). Para el
 *                      curso real publicado: 7.
 *
 *   N (modulesSeen)  = cuántos de esos M ítems aparecen en
 *                      `enrollment.scoStates`. Un CONTEO, no una posición.
 *
 * HISTORIA DE ESTA REGLA — por qué es un conteo y no una posición.
 * La primera versión (hallazgo H-6) numeraba por la POSICIÓN, en el orden del
 * manifiesto, del SCO más avanzado presente. Con los datos reales eso rompe:
 * la matrícula `zephyracs` tiene ITEM_UNIDAD_01, ITEM_UNIDAD_03 e
 * ITEM_RECURSOS — saltó cuatro unidades y tocó el último ítem del curso— y la
 * regla de posición le daba "Módulo 7 de 7", o sea que la pantalla le decía
 * que había recorrido el curso entero. Ése es exactamente el malentendido que
 * este sprint vino a arreglar. **Decisión de Tomás, 2026-09-07: la señal pasa
 * a ser conteo de módulos vistos, no posición del más lejano.** Con la regla
 * nueva `zephyracs` da 3 de 7, que es lo que efectivamente vio.
 *
 * PROPIEDADES QUE LA REGLA GARANTIZA (las cuatro tienen test):
 *
 *  - NO RETROCEDE. `scoStates` sólo crece: recordScormEvent hace
 *    `{...prevScoStates}` y agrega, nunca borra. Contar claves distintas de un
 *    mapa que sólo crece es monótono por construcción. La spec lo exige como
 *    invariante ("la señal no retrocede entre eventos de una misma sesión") y
 *    acá se cumple estructuralmente, no por cuidado.
 *
 *  - NO PREMIA EL SALTO. Tocar el último módulo suma exactamente 1, igual que
 *    tocar el primero. No hay forma de adelantar la señal salteando.
 *
 *  - SÓLO CUENTA LO QUE ESTÁ EN EL MANIFIESTO. Se barre la lista del CURSO y
 *    se pregunta si cada ítem está en `scoStates`, no al revés. Una clave de
 *    `scoStates` que no figure en `scoStructure` no suma — el caso que
 *    schema.ts advierte en `lmsEnrollments.scoStates`: un curso re-ingestado
 *    puede tener otra estructura, y el curso es la única fuente de verdad del
 *    denominador. Sin esto, `modulesSeen` podría superar a `moduleTotal`.
 *
 *  - `actual` NO ENTRA EN EL CONTEO. Es el índice de página DENTRO de un SCO;
 *    usarlo para numerar módulos repetiría exactamente el error que la spec
 *    denuncia. Su único uso acá es `anyModuleAdvanced`.
 *
 * POR QUÉ ESTO SÍ SE MUEVE Y `done` NO (AC 18): la sola PRESENCIA de la clave
 * en `scoStates` ya prueba que la alumna abrió ese SCO — el reproductor
 * escribe la entrada en el primer `LMSSetValue`. Nati, con `done` vacío en el
 * 100% de sus muestras, tiene cinco ítems del curso en `scoStates`, o sea
 * "5 de 7 módulos vistos". Un criterio basado en `done` le daría cero.
 *
 * BORDE QUE LOS DATOS YA MUESTRAN: `ITEM_PRESENTACION` aparece en la base SIN
 * `lessonStatus`, sólo con `suspendData`. La derivación NUNCA asume que la
 * clave existe.
 *
 * ============================================================================
 * POR QUÉ NO HAY TÍTULO DE MÓDULO EN ESTE CONTRATO
 * ============================================================================
 *
 * La versión anterior devolvía `moduleTitle`, el título del módulo en el que
 * la alumna estaba. Con la regla de conteo ese "en el que estás" ya no
 * existe: un conteo no apunta a ningún ítem. El único título que se podría
 * devolver sin inventar nada es "el último presente EN ORDEN DE MANIFIESTO",
 * y ése no es "el último que visitó": `scoStates` no guarda ninguna marca de
 * tiempo por SCO salvo `completedAt`, que sólo se escribe al completar. Para
 * `zephyracs` ese título sería "Recursos" — o sea, volveríamos a poner en
 * pantalla justo la señal que se acaba de decidir que engaña, sólo que en
 * otro campo. Se saca del contrato. Si más adelante hace falta un "seguir en
 * X", va a necesitar una marca de tiempo por SCO que hoy no se persiste, y
 * eso es trabajo de escritura, no de lectura (o sea, fuera de D-1).
 */

import { extractScoItems } from "./scoStructure";
import { parseSuspendData } from "./suspendData";

/**
 * Estado grueso del recorrido. Literales en inglés, como el resto de los
 * enums del schema (`active`/`completed`/`expired`, `incomplete`): la copia
 * en español la arma la pantalla, no el backend.
 *
 * - `not-started` — no vio NINGÚN módulo del curso.
 * - `in-progress` — vio al menos uno y no están todos terminales.
 * - `completed`   — TODOS los SCOs declarados por el curso están terminales.
 */
export type CoursePositionState = "not-started" | "in-progress" | "completed";

export interface CoursePosition {
  /**
   * Cuántos módulos del curso vio. CONTEO, no índice: `modulesSeen === 3` no
   * dice cuáles, dice cuántos. 0 si no empezó. Nunca mayor que `moduleTotal`.
   * La pantalla lo lee como "{modulesSeen} de {moduleTotal} módulos vistos".
   */
  modulesSeen: number;
  /**
   * Cantidad de módulos (ítems SCO) que declara el curso. 0 si el curso no
   * tiene `scoStructure` — la pantalla tiene que aguantar ese caso sin
   * renderizar "0 de 0 módulos vistos".
   */
  moduleTotal: number;
  /** Ver CoursePositionState. */
  state: CoursePositionState;
  /**
   * ¿Hay evidencia de haberse movido dentro de ALGÚN módulo, más allá de su
   * primera página? Sale de `suspend_data` (`done` no vacío o `actual > 0`)
   * de cualquiera de los módulos vistos. Es el único uso de `actual`.
   *
   * Para qué sirve: distingue "abrió tres módulos y no leyó nada" de "está
   * leyendo". `modulesSeen` solo no lo distingue, porque la clave de
   * `scoStates` se escribe con el primer LMSSetValue del SCO. Es OPCIONAL
   * para la pantalla: ignorarlo no rompe la copia.
   *
   * NO es por-módulo a propósito: sin marca de tiempo por SCO no se puede
   * decir "el módulo actual", así que la pregunta honesta es "¿alguno?".
   */
  anyModuleAdvanced: boolean;
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
  modulesSeen: 0,
  moduleTotal: 0,
  state: "not-started",
  anyModuleAdvanced: false,
};

/**
 * Deriva el avance de una matrícula. FUNCIÓN TOTAL: no lanza nunca, para
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
    // hay contra qué contar: se devuelve lo mínimo honesto. `in-progress` si
    // hay estado, porque la alumna claramente entró a algo.
    const algo = Object.keys(states).length > 0;
    return {
      ...EMPTY_POSITION,
      state: algo ? "in-progress" : "not-started",
    };
  }

  // Un solo barrido sobre la lista del CURSO (nunca sobre las claves de
  // scoStates — ver "sólo cuenta lo que está en el manifiesto"):
  //  - cuántos ítems del curso están presentes  -> modulesSeen
  //  - si TODOS están en estado terminal        -> state === "completed"
  //  - si alguno muestra avance intra-SCO       -> anyModuleAdvanced
  let modulesSeen = 0;
  let allTerminal = true;
  let anyModuleAdvanced = false;

  for (const item of items) {
    const present = Object.prototype.hasOwnProperty.call(
      states,
      item.identifier
    );
    if (!present) {
      // Un SCO nunca abierto no está terminado. AC 19: nada dice "completo"
      // si algún SCO no lo está.
      allTerminal = false;
      continue;
    }
    modulesSeen += 1;

    const state = states[item.identifier];
    const status = state?.lessonStatus;
    // `lessonStatus` puede faltar (ITEM_PRESENTACION en los datos reales) y
    // eso ya es "no terminado". Nunca se asume que la clave existe.
    if (!status || !TERMINAL_COMPLETE.has(status)) allTerminal = false;
    if (!anyModuleAdvanced && parseSuspendData(state?.suspendData).advanced) {
      anyModuleAdvanced = true;
    }
  }

  return {
    modulesSeen,
    moduleTotal,
    state:
      modulesSeen === 0
        ? "not-started"
        : allTerminal
          ? "completed"
          : "in-progress",
    anyModuleAdvanced,
  };
}
