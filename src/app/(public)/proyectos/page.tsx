'use client';

import { useQuery } from 'convex/react';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '../../../../convex/_generated/api';
import { Skeleton } from '@/components/ui/Skeleton';
import { getProjectImage } from '@/lib/staticImages';
import styles from './ProyectosPage.module.css';

export default function ProyectosPage() {
  const projects = useQuery(api.projects.listPublic);

  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <div className={styles.container}>
          <h1 className={styles.title}>Nuestros Proyectos</h1>
          <p className={styles.subtitle}>
            Conoce algunos de los proyectos en los que hemos trabajado junto a organizaciones comprometidas con la sostenibilidad.
          </p>
        </div>
      </section>

      <section className={styles.content}>
        <div className={styles.container}>
          {projects === undefined ? (
            <div className={styles.grid}>
              {Array.from({ length: 6 }).map((_, index) => (
                <ProjectCardSkeleton key={index} />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyText}>
                Proximamente compartiremos nuestros proyectos.
              </p>
            </div>
          ) : (
            <div className={styles.grid}>
              {projects.map((project) => {
                const imageUrl = getProjectImage(project.slug, project.imageUrl);
                return (
                  <Link
                    key={project._id}
                    href={`/proyectos/${project.slug}`}
                    className={styles.card}
                  >
                    <div className={styles.cardImage}>
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
                          <span className="material-icons">work</span>
                        </div>
                      )}
                    {project.isFeatured && (
                      <span className={styles.featured}>Destacado</span>
                    )}
                  </div>
                  <div className={styles.cardContent}>
                    <h2 className={styles.cardTitle}>{project.title}</h2>
                    <p className={styles.cardExcerpt}>{project.excerpt}</p>
                    {project.achievements.length > 0 && (
                      <div className={styles.achievements}>
                        <span className={styles.achievementsCount}>
                          {project.achievements.length} logro{project.achievements.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function ProjectCardSkeleton() {
  return (
    <div className={styles.cardSkeleton}>
      <Skeleton variant="rectangular" width="100%" height={200} />
      <div className={styles.cardSkeletonContent}>
        <Skeleton variant="text" width="80%" height={28} />
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="90%" />
        <Skeleton variant="text" width="40%" />
      </div>
    </div>
  );
}
