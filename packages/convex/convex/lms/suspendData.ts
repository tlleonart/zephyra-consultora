/**
 * LMS — parser de `cmi.suspend_data` (T-be-001, AC 17 y AC 22).
 *
 * Módulo PURO: no importa nada de Convex. Se testea solo y lo consume la
 * derivación de posición (lms/coursePosition.ts). NO lo consume
 * recordScormEvent: por decisión D-1 la señal de posición se deriva en
 * LECTURA y convex/lms/scormEvents.ts no se toca.
 *
 * ============================================================================
 * CARACTERIZACIÓN — por qué parseamos lo que parseamos (AC 17)
 * ============================================================================
 *
 * `cmi.suspend_data` es, por norma SCORM 1.2, una cadena OPACA: el contenido
 * escribe ahí lo que quiere y el LMS no puede asumir ninguna forma. Así que la
 * forma no se supone: se midió.
 *
 * Fuente: volcado de staging previo al reset del 2026-09-04, en
 * `evidence/reset-2026-09-04/` (irreproducible — la base se reseteó).
 *
 * Se midieron DOS poblaciones, por el hallazgo H-7:
 *
 *  1. `lmsScormEvents` — 264 filas con `element === "cmi.suspend_data"`
 *     (sobre 1461 eventos totales). Justifican el PARSER: son todas las
 *     escrituras que el contenido emitió en la historia del deployment.
 *     NO sirven para atribuir muestra <-> SCO, porque `lmsScormEvents` no
 *     guarda `scoId` (schema.ts: enrollmentId, timestamp, element, value,
 *     commitId). Por eso el fixture de derivación sale de la otra población.
 *
 *  2. `lmsEnrollments.scoStates` — 18 estados por-SCO, sobre 10 matrículas
 *     (4 con `scoStates` no vacío). Acá sí hay atribución SCO <-> payload, y
 *     de acá sale el fixture de `coursePosition`.
 *
 * Medición sobre las 264 muestras de la población 1:
 *
 *   | Medición                        | Resultado                            |
 *   |---------------------------------|--------------------------------------|
 *   | muestras                        | 264                                  |
 *   | fallas de parseo JSON           | 0                                    |
 *   | valores que no son objeto JSON  | 0 (264/264 objeto)                   |
 *   | conjuntos de claves distintos   | 1 — exactamente `{done, actual}`     |
 *   | longitud máxima del texto crudo | 37 bytes (tope SCORM: 4096)          |
 *   | tipo de los elementos de `done` | entero, siempre                      |
 *   | valores vistos en `done`        | 0..7                                 |
 *   | tipo de `actual`                | entero, siempre                      |
 *   | valores vistos en `actual`      | 0..8                                 |
 *   | `len(done) === 0`               | 167 de 264 (63%)                     |
 *   | muestras vacías (`""`)          | 0                                    |
 *
 * La población 2 (18 muestras) da el mismo resultado: 18/18 objeto, un solo
 * conjunto de claves `{done, actual}`, cero fallas.
 *
 * CONCLUSIONES QUE FIJAN EL DISEÑO:
 *
 *  - La forma canónica es `{"done": number[], "actual": number}`. Índices
 *    desde 0. `done` = páginas completadas dentro del SCO; `actual` = página
 *    actual dentro del SCO.
 *
 *  - `actual` es POSICIÓN, no TOTAL. No existe ningún campo con el total de
 *    páginas del SCO. Por lo tanto una fracción honesta NO es derivable de
 *    este payload, y este módulo no expone —ni va a exponer— ningún
 *    porcentaje. Estimar el total para sacar una fracción es exactamente el
 *    riesgo S9 de la spec. No se hace.
 *
 *  - `done` vacío NO significa "no avanzó". En 167 de 264 muestras `done`
 *    está vacío; para las dos testers reales (Nati, Marcos) está vacío en el
 *    100% de sus muestras, con `actual` llegando a 6 y 5 respectivamente.
 *    Cualquier señal que dependa sólo de `done` les da cero. Por eso
 *    `advanced` mira `done` Y `actual`.
 *
 *  - El truncado no se rescata a mano. SCORM 1.2 topea `suspend_data` en 4096
 *    caracteres; un payload truncado deja el JSON abierto y no parsea. No
 *    intentamos recuperarlo con expresiones regulares: el máximo real
 *    observado es de 37 bytes (dos órdenes de magnitud por debajo del tope),
 *    así que un rescate sería código escrito contra una forma que nunca
 *    ocurrió — es decir, contra una suposición, que es justo lo que AC 17
 *    prohíbe. Degradamos a la señal más gruesa disponible ("el SCO escribió
 *    estado", o sea `touched`) y seguimos.
 *
 * ============================================================================
 * CONTRATO DE ROBUSTEZ (AC 22)
 * ============================================================================
 *
 * `parseSuspendData` NUNCA lanza, para ningún valor de entrada. Es una función
 * total: `string | null | undefined` -> `SuspendDataSignal`. Un error de
 * parseo no puede romper el reproductor ni impedir que se escriba la
 * matrícula. Los cuatro casos que AC 22 nombra —JSON inválido, vacío,
 * truncado a 4096, forma desconocida— degradan a la señal más gruesa
 * disponible y devuelven algo usable.
 */

/**
 * En qué estado quedó el parseo. Deliberadamente más fino que un booleano:
 * quien consuma esto puede distinguir "no hay dato" de "hay dato y es basura",
 * que no son lo mismo para la señal que ve la alumna.
 *
 * - `absent`    — no hay `suspend_data` (null/undefined). El SCO nunca escribió.
 * - `empty`     — cadena vacía o sólo espacios. El SCO escribió, sin contenido.
 * - `invalid`   — no es JSON válido. Incluye el truncado a 4096.
 * - `unknown`   — JSON válido pero NO un objeto con alguna de las dos claves.
 * - `partial`   — objeto JSON, pero falta o no tipa alguna de las dos claves.
 * - `canonical` — objeto con `done: number[]` y `actual: number`. Las 264.
 */
export type SuspendDataShape =
  | "absent"
  | "empty"
  | "invalid"
  | "unknown"
  | "partial"
  | "canonical";

export interface SuspendDataSignal {
  /** Qué se pudo reconocer. Ver SuspendDataShape. */
  shape: SuspendDataShape;
  /**
   * Índices de página completados, saneados: enteros >= 0, sin duplicados,
   * ascendentes. SIEMPRE un array — `[]` cuando no hay nada derivable, nunca
   * null, para que el consumidor no tenga que ramificar.
   */
  done: number[];
  /**
   * Índice de página actual DENTRO del SCO, o null si no es derivable.
   * NO es un total y no se puede convertir en fracción (ver caracterización).
   */
  actual: number | null;
  /**
   * ¿El SCO escribió estado alguna vez? La señal más gruesa que existe: es
   * true incluso cuando el payload es basura, porque el hecho de que haya
   * texto ya prueba que el contenido corrió y commiteó.
   */
  touched: boolean;
  /**
   * ¿Hay evidencia de haberse movido más allá del arranque del SCO?
   * `done` no vacío O `actual > 0`. Mira las dos señales a propósito: con
   * `done` solo, las dos testers reales dan false (ver caracterización).
   */
  advanced: boolean;
}

/** Tope de `cmi.suspend_data` en SCORM 1.2 (4096 caracteres). Ver arriba. */
export const SCORM_SUSPEND_DATA_MAX_LENGTH = 4096;

const EMPTY_SIGNAL: SuspendDataSignal = {
  shape: "absent",
  done: [],
  actual: null,
  touched: false,
  advanced: false,
};

/** Entero finito >= 0. Los índices de página nunca son negativos ni decimales. */
function isPageIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * Sanea `done`: descarta lo que no sea índice de página, deduplica y ordena.
 * Devuelve también si quedó limpio, para poder marcar `partial`.
 */
function sanitizeDone(raw: unknown): { done: number[]; clean: boolean } {
  if (!Array.isArray(raw)) return { done: [], clean: false };
  const kept = new Set<number>();
  let clean = true;
  for (const entry of raw) {
    if (isPageIndex(entry)) kept.add(entry);
    else clean = false;
  }
  return { done: Array.from(kept).sort((a, b) => a - b), clean };
}

/**
 * Parsea `cmi.suspend_data`. FUNCIÓN TOTAL: no lanza nunca, para ninguna
 * entrada. Ver el contrato de robustez arriba (AC 22).
 */
export function parseSuspendData(
  raw: string | null | undefined
): SuspendDataSignal {
  if (typeof raw !== "string") {
    return { ...EMPTY_SIGNAL };
  }
  if (raw.trim().length === 0) {
    // El SCO escribió, pero no hay contenido. `touched` sí, nada más.
    return { ...EMPTY_SIGNAL, shape: "empty", touched: true };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // JSON inválido — incluye el truncado a 4096. Degradamos a `touched`.
    // Sin rescate por expresión regular: ver la caracterización.
    return { ...EMPTY_SIGNAL, shape: "invalid", touched: true };
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    // JSON válido pero de otra forma (array, número, cadena, null). El
    // contenido cambió de formato o es otro paquete SCORM. No inventamos nada.
    return { ...EMPTY_SIGNAL, shape: "unknown", touched: true };
  }

  const obj = parsed as Record<string, unknown>;
  const hasDoneKey = "done" in obj;
  const hasActualKey = "actual" in obj;

  const { done, clean: doneClean } = sanitizeDone(obj.done);
  const actual = isPageIndex(obj.actual) ? obj.actual : null;

  const doneOk = hasDoneKey && Array.isArray(obj.done) && doneClean;
  const actualOk = hasActualKey && actual !== null;

  let shape: SuspendDataShape;
  if (doneOk && actualOk) shape = "canonical";
  else if (hasDoneKey || hasActualKey) shape = "partial";
  else shape = "unknown";

  return {
    shape,
    done,
    actual,
    touched: true,
    advanced: done.length > 0 || (actual !== null && actual > 0),
  };
}
