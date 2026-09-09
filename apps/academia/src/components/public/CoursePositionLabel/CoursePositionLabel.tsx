import {
  coursePositionLabel,
  type CoursePosition,
} from './positionText';
import styles from './CoursePositionLabel.module.css';

/**
 * La señal de avance de una matrícula. Deliberadamente chica: el día que el
 * porcentaje sea honesto, esto se reemplaza por una barra sin tocar la tarjeta
 * ni la pantalla que la contiene.
 *
 * Nada de `role="progressbar"`: no hay un valor entre 0 y 100 que anunciar, y
 * un progressbar sin `aria-valuenow` honesto le miente al lector de pantalla
 * igual que el número le mentiría a quien ve.
 */
export interface CoursePositionLabelProps {
  position: CoursePosition;
}

export function CoursePositionLabel({ position }: CoursePositionLabelProps) {
  const { state, detail } = coursePositionLabel(position);

  return (
    <p className={styles.root}>
      <span className={styles.state}>{state}</span>
      {detail ? (
        <>
          <span aria-hidden="true" className={styles.separator}>
            ·
          </span>
          <span className={styles.detail}>{detail}</span>
        </>
      ) : null}
    </p>
  );
}
