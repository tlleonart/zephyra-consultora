'use client';

import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import styles from './ProjectsSection.module.css';
import { Skeleton } from '@/components/ui/Skeleton/Skeleton';
import Link from 'next/link';
import Image from 'next/image';
import { getProjectImage } from '@/lib/staticImages';

export const ProjectsSection = () => {
  const projects = useQuery(api.projects.listFeatured);

  const isLoading = projects === undefined;

  return (
    <section id="proyectos" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>Proyectos Destacados</h2>
          <p className={styles.description}>
            Conoce algunos de los proyectos en los que hemos colaborado
          </p>
        </div>

        {isLoading ? (
          <div className={styles.grid}>
            {[1, 2, 3].map((n) => (
              <div key={n} className={styles.card}>
                <Skeleton width="100%" height={200} />
                <div className={styles.cardContent}>
                  <Skeleton width="80%" height={24} />
                  <Skeleton width="100%" height={60} style={{ marginTop: 8 }} />
                </div>
              </div>
            ))}
          </div>
        ) : projects && projects.length > 0 ? (
          <div className={styles.grid}>
            {projects.map((project) => {
              const imageUrl = getProjectImage(project.slug, project.imageUrl);
              return (
                <Link
                  key={project._id}
                  href={`/proyectos/${project.slug}`}
                  className={styles.card}
                >
                  <div className={styles.imageWrapper}>
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={project.title}
                        fill
                        className={styles.image}
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    ) : (
                      <div className={styles.imagePlaceholder}>
                        <span className="material-icons">eco</span>
                      </div>
                    )}
                  </div>
                <div className={styles.cardContent}>
                  <h3 className={styles.cardTitle}>{project.title}</h3>
                  <p className={styles.cardExcerpt}>{project.excerpt}</p>
                  {project.achievements && project.achievements.length > 0 && (
                    <ul className={styles.achievements}>
                      {project.achievements.slice(0, 2).map((achievement) => (
                        <li key={achievement._id} className={styles.achievement}>
                          <span className="material-icons">check_circle</span>
                          <span>{achievement.description}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Link>
              );
            })}
          </div>
        ) : (
          <p className={styles.emptyMessage}>
            Proximamente compartiremos nuestros proyectos.
          </p>
        )}

        {projects && projects.length > 0 && (
          <div className={styles.viewAll}>
            <Link href="/proyectos" className={styles.viewAllLink}>
              Ver todos los proyectos
              <span className="material-icons">arrow_forward</span>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
};
