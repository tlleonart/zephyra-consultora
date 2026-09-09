import type { ReactNode } from "react";
import styles from "./EmptyCoursesState.module.css";

/**
 * The catalog's empty state ("Próximamente nuevos cursos…") — one place so
 * `/cursos` and `/` (the home's course grid, T-06) render the identical
 * text and treatment instead of each growing its own. Spec §3.3: the home
 * must reuse this exact state, not invent a second one.
 *
 * SE PARAMETRIZÓ LA COPIA, Y NO ES UN CAPRICHO. `/cursos/mis-cursos` necesita
 * el mismo tratamiento visual —la misma tarjeta, el mismo ✦, el mismo
 * centrado— pero NO el mismo texto: "Próximamente nuevos cursos" le dice a una
 * alumna sin matrículas que todavía no publicamos nada, y eso es falso. Hay
 * catálogo; lo que no tiene es un curso suyo. Mandarle ese texto sería
 * decirle que el problema es nuestro cuando el camino es comprar.
 *
 * Los dos parámetros son OPCIONALES y sus valores por defecto son exactamente
 * lo que este componente pintaba antes, así que `/cursos` y `/` no cambian ni
 * un byte de marcado. Lo que se comparte es el tratamiento; lo que cambia es
 * la frase — que es justo al revés de escribir un segundo componente.
 */

/** El texto del catálogo, exportado para que un test lo fije en vez de repetirlo. */
export const EMPTY_CATALOG_TEXT =
  "Próximamente nuevos cursos. Estamos preparando contenidos para acompañarte. Volvé pronto.";

export interface EmptyCoursesStateProps {
  /** Por defecto, el texto del catálogo. */
  text?: ReactNode;
  /** Una salida opcional: el catálogo no tiene a dónde mandar, "mis cursos" sí. */
  action?: ReactNode;
}

export function EmptyCoursesState({
  text = EMPTY_CATALOG_TEXT,
  action,
}: EmptyCoursesStateProps = {}) {
  return (
    <div className={styles.empty}>
      <span className={styles.icon} aria-hidden="true">
        ✦
      </span>
      <p className={styles.text}>{text}</p>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
