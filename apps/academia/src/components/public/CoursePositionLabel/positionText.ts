/**
 * La señal de avance, en castellano y en un solo lugar.
 *
 * ES UN CONTEO, NO UN PORCENTAJE, y no es una preferencia de copia: no hay
 * fracción honesta que mostrar. `progressPercent` vale 0 en la base para todas
 * las matrículas —incluidas las que sí avanzaron— porque depende de que el
 * contenido mande `lesson_status: completed`, y en toda la historia del
 * deployment eso pasó una vez, en una matrícula de fixture. Mandar ese número a
 * la pantalla sería mandar una mentira; derivar uno nuevo estimando el total de
 * páginas sería inventarlo.
 *
 * Y TAMPOCO ES UNA POSICIÓN. La primera versión de esta pantalla iba a decir
 * "Módulo 5 de 7", pero el manifiesto real declara los siete ítems como `sco`,
 * "Recursos" incluido: una alumna que abrió Unidad 1, Unidad 3 y Recursos leía
 * "Módulo 7 de 7" habiendo salteado cuatro unidades. Un conteo de módulos
 * vistos no tiene ese problema — es una cardinalidad, no un orden.
 *
 * POR QUÉ VIVE APARTE Y ES CHICO. La spec pide que esto sea reversible: si más
 * adelante entra el rediseño de la navegación del reproductor y el porcentaje
 * pasa a ser honesto, la barra reemplaza a este texto sin tocar el resto de la
 * pantalla. Esa promesa sólo se sostiene si la señal está en un módulo propio.
 *
 * `anyModuleAdvanced` NO SE USA, a propósito. Distingue "abrió tres módulos y
 * no leyó nada" de "está leyendo", y la copia que se entrega —"vistos"— es
 * justamente la afirmación débil que las dos situaciones sostienen. Usarlo
 * exigiría dos frases distintas para una diferencia que la alumna no pidió
 * saber. Queda disponible el día que haya algo que decir con él.
 */

export interface CoursePosition {
  /** CONTEO de módulos vistos. 0 = no empezó. Nunca mayor que `moduleTotal`. */
  modulesSeen: number;
  /** Total de módulos del curso. 0 si el curso no declara estructura. */
  moduleTotal: number;
  state: 'not-started' | 'in-progress' | 'completed';
  anyModuleAdvanced: boolean;
}

export interface CoursePositionLabelText {
  /** Siempre presente: en qué anda la matrícula. */
  state: string;
  /** El conteo. `null` cuando no hay un total en el que apoyarlo. */
  detail: string | null;
}

const STATE_TEXT: Record<CoursePosition['state'], string> = {
  'not-started': 'Todavía no empezaste',
  'in-progress': 'En curso',
  completed: 'Completado',
};

export const coursePositionLabel = ({
  modulesSeen,
  moduleTotal,
  state,
}: CoursePosition): CoursePositionLabelText => {
  const stateText = STATE_TEXT[state] ?? STATE_TEXT['not-started'];

  // `moduleTotal === 0` es un caso REAL: un curso sin `scoStructure`. Acá no se
  // pinta "0 de 0 módulos vistos", que además de feo afirma que el curso no
  // tiene contenido — y eso no es lo que sabemos. Lo que sabemos es que no
  // conocemos el total. Sin total no hay conteo que mostrar, así que va el
  // estado solo.
  if (moduleTotal <= 0) return { state: stateText, detail: null };

  const singular = moduleTotal === 1;

  // Sin empezar, "0 de 7 módulos vistos" repite lo que el estado ya dijo. Se
  // muestra el tamaño del curso, que sí es información nueva.
  if (state === 'not-started' || modulesSeen <= 0) {
    return {
      state: stateText,
      detail: singular ? '1 módulo' : `${moduleTotal} módulos`,
    };
  }

  return {
    state: stateText,
    detail: singular
      ? '1 de 1 módulo visto'
      : `${modulesSeen} de ${moduleTotal} módulos vistos`,
  };
};
