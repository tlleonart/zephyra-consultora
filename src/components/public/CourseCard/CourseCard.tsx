import Link from "next/link";
import Image from "next/image";
import styles from "./CourseCard.module.css";

export interface CourseCardData {
  slug: string;
  title: string;
  description: string;
  scoCount: number;
  coverUrl: string | null;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : max).trimEnd()}…`;
}

export function CourseCard({
  slug,
  title,
  description,
  scoCount,
  coverUrl,
}: CourseCardData) {
  const moduleLabel =
    scoCount === 1 ? "1 módulo" : scoCount > 1 ? `${scoCount} módulos` : null;

  return (
    <Link href={`/cursos/${slug}`} className={styles.card}>
      <div className={styles.imageWrapper}>
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={title}
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
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.description}>{truncate(description, 140)}</p>
        <div className={styles.footer}>
          {moduleLabel ? (
            <span className={styles.meta}>{moduleLabel}</span>
          ) : (
            <span />
          )}
          <span className={styles.cta} aria-hidden="true">
            Ver más →
          </span>
        </div>
      </div>
    </Link>
  );
}
