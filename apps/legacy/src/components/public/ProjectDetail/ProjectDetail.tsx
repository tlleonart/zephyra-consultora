'use client';

import Link from 'next/link';
import { cn } from '@/lib/cn';
import { AchievementsList } from '@/components/public/AchievementsList';
import styles from './ProjectDetail.module.css';

interface Achievement {
  _id: string;
  description: string;
  displayOrder: number;
}

interface Project {
  _id: string;
  title: string;
  slug: string;
  description: string;
  excerpt: string;
  imageUrl: string | null;
  isFeatured: boolean;
  achievements: Achievement[];
  createdAt: number;
  updatedAt: number;
}

interface RelatedProject {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  imageUrl: string | null;
}

interface ProjectDetailProps {
  project: Project;
  relatedProjects?: RelatedProject[];
  className?: string;
}

export const ProjectDetail = ({
  project,
  relatedProjects,
  className,
}: ProjectDetailProps) => {
  return (
    <article className={cn(styles.container, className)}>
      {/* Hero Section with Cover Image */}
      <section className={styles.hero}>
        {project.imageUrl ? (
          <div className={styles.heroImage}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={project.imageUrl}
              alt={project.title}
              className={styles.coverImage}
            />
            <div className={styles.heroOverlay} />
          </div>
        ) : (
          <div className={styles.heroPlaceholder}>
            <span className={styles.placeholderIcon}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </span>
          </div>
        )}
        <div className={styles.heroContent}>
          <div className={styles.heroInner}>
            {project.isFeatured && (
              <span className={styles.featuredBadge}>Proyecto destacado</span>
            )}
            <h1 className={styles.title}>{project.title}</h1>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className={styles.content}>
        <div className={styles.contentInner}>
          {/* Back Link */}
          <Link href="/proyectos" className={styles.backLink}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Volver a proyectos
          </Link>

          {/* Description */}
          <div className={styles.description}>
            <h2 className={styles.sectionTitle}>Sobre el proyecto</h2>
            <p className={styles.descriptionText}>{project.description}</p>
          </div>

          {/* Achievements */}
          {project.achievements && project.achievements.length > 0 && (
            <AchievementsList achievements={project.achievements} />
          )}

          {/* Related Projects */}
          {relatedProjects && relatedProjects.length > 0 && (
            <div className={styles.relatedSection}>
              <h2 className={styles.sectionTitle}>Otros proyectos</h2>
              <div className={styles.relatedGrid}>
                {relatedProjects.map((related) => (
                  <Link
                    key={related._id}
                    href={`/proyectos/${related.slug}`}
                    className={styles.relatedCard}
                  >
                    <div className={styles.relatedImageWrapper}>
                      {related.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={related.imageUrl}
                          alt={related.title}
                          className={styles.relatedImage}
                        />
                      ) : (
                        <div className={styles.relatedPlaceholder}>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="32"
                            height="32"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className={styles.relatedContent}>
                      <h3 className={styles.relatedTitle}>{related.title}</h3>
                      <p className={styles.relatedExcerpt}>{related.excerpt}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Bottom CTA */}
          <div className={styles.bottomCta}>
            <Link href="/" className={styles.ctaLink}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Volver al inicio
            </Link>
          </div>
        </div>
      </section>
    </article>
  );
};
