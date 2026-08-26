import styles from "./EmptyCoursesState.module.css";

/**
 * The catalog's empty state ("Próximamente nuevos cursos…") — one place so
 * `/cursos` and `/` (the home's course grid, T-06) render the identical
 * text and treatment instead of each growing its own. Spec §3.3: the home
 * must reuse this exact state, not invent a second one.
 */
export function EmptyCoursesState() {
  return (
    <div className={styles.empty}>
      <span className={styles.icon} aria-hidden="true">
        ✦
      </span>
      <p className={styles.text}>
        Próximamente nuevos cursos. Estamos preparando contenidos para
        acompañarte. Volvé pronto.
      </p>
    </div>
  );
}
