/**
 * UAT2 — la señal por módulo que deriva el servidor desde `suspend_data`
 * (lms/scormEvents.ts). NO es una fracción: el contenido nunca dice cuántas
 * secciones tiene un módulo, así que `sectionsDone` es un conteo y
 * `currentSection` una posición. Escribirlos como "N de M" sería inventar el M.
 */
export interface ScoSignal {
  sectionsDone: number;
  currentSection: number | null;
  touched: boolean;
  advanced: boolean;
}

/**
 * Qué decir de un módulo, en palabras. Existe porque el punto de color no
 * alcanzaba: las testers recorrieron el curso entero y vieron 0% sin ninguna
 * explicación de por qué. El tilde sigue estando; esto le pone texto al lado.
 */
export const moduleStateText = (
  completed: boolean,
  signal: ScoSignal | undefined
): string | null => {
  if (completed) return "Completo";
  if (!signal || !signal.touched) return null;
  if (signal.sectionsDone > 0) {
    return signal.sectionsDone === 1
      ? "En curso · 1 sección recorrida"
      : `En curso · ${signal.sectionsDone} secciones recorridas`;
  }
  if (signal.currentSection !== null && signal.currentSection > 1) {
    return `En curso · vas por la sección ${signal.currentSection}`;
  }
  return "Empezado";
};
