import Link from 'next/link';
import Image from 'next/image';
import { CoursePositionLabel } from '@/components/public/CoursePositionLabel';
import type { CoursePosition } from '@/components/public/CoursePositionLabel';
import styles from './MyCourseCard.module.css';

/**
 * La tarjeta de un curso de la alumna: portada, título, avance y Continuar.
 *
 * POR QUÉ NO ES `CourseCard`. Aquélla es una tarjeta de CATÁLOGO: la envuelve
 * entera un `<Link>` a la ficha, muestra descripción y "Ver más". Acá la
 * alumna ya compró, no hay nada que decidir, y el destino es otro: el
 * reproductor. Envolver todo en un enlace además dejaría el botón Continuar
 * anidado dentro de otro enlace, que es marcado inválido y rompe el teclado.
 * Comparten el TRATAMIENTO de portada faltante, que es lo que importaba
 * compartir.
 *
 * LA PORTADA FALTANTE NO ES UN CASO DE BORDE. Hoy en staging no hay ninguna
 * cargada, y dos de tres testers reportaron el marcador de posición como una
 * falla. Así que el caso sin portada usa el mismo degradado de marca con el ◆
 * que ya usa el catálogo: se ve deliberado, no roto.
 */
export interface MyCourseCardProps {
  courseSlug: string;
  courseTitle: string;
  coverUrl: string | null;
  position: CoursePosition;
}

export function MyCourseCard({
  courseSlug,
  courseTitle,
  coverUrl,
  position,
}: MyCourseCardProps) {
  return (
    <article className={styles.card}>
      <div className={styles.imageWrapper}>
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt=""
            fill
            className={styles.image}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className={styles.placeholder} aria-hidden="true">
            <span className={styles.placeholderIcon}>◆</span>
          </div>
        )}
      </div>
      <div className={styles.content}>
        <h2 className={styles.title}>{courseTitle}</h2>
        <CoursePositionLabel position={position} />
        {/* El nombre accesible lleva el título: en una lista de tarjetas,
            cinco enlaces que dicen "Continuar" son indistinguibles para quien
            navega por enlaces con un lector de pantalla. */}
        <Link
          href={`/cursos/${courseSlug}/player`}
          className={styles.action}
          aria-label={`Continuar ${courseTitle}`}
        >
          Continuar
        </Link>
      </div>
    </article>
  );
}
