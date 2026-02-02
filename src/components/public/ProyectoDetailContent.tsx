'use client';

import { useParams } from 'next/navigation';
import { useQuery } from 'convex/react';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '../../../convex/_generated/api';
import { Skeleton } from '@/components/ui/Skeleton';
import { ClientOnly } from '@/components/ClientOnly';
import { getProjectImage } from '@/lib/staticImages';
import styles from '@/app/(public)/proyectos/[slug]/ProyectoDetail.module.css';

export function ProyectoDetailContent() {
  return (
    <ClientOnly fallback={<ProjectDetailSkeleton />}>
      <ProyectoDetailInner />
    </ClientOnly>
  );
}

function ProyectoDetailInner() {
  const params = useParams();
  const slug = params?.slug as string;

  const project = useQuery(api.projects.getBySlug, { slug });
  const allProjects = useQuery(api.projects.listPublic);

  // Loading state
  if (project === undefined) {
    return <ProjectDetailSkeleton />;
  }

  // Not found state
  if (project === null) {
    return (
      <div className={styles.notFound}>
        <h1 className={styles.notFoundTitle}>Proyecto no encontrado</h1>
        <p className={styles.notFoundText}>
          El proyecto que buscas no existe o ha sido eliminado.
        </p>
        <Link href="/proyectos" className={styles.backLink}>
          Ver todos los proyectos
        </Link>
      </div>
    );
  }

  // Get related projects
  const relatedProjects = allProjects
    ?.filter((p) => p._id !== project._id)
    .slice(0, 3);

  const heroImageUrl = getProjectImage(slug, project.imageUrl);

  return (
    <>
      {/* Hero */}
      <section className={styles.hero}>
        {heroImageUrl && (
          <>
            <Image
              src={heroImageUrl}
              alt={project.title}
              fill
              priority
              className={styles.heroImage}
              sizes="100vw"
            />
            <div className={styles.heroOverlay} />
          </>
        )}
        <div className={styles.heroContent}>
          <Link href="/proyectos" className={styles.breadcrumb}>
            <span className={styles.backArrow}>&#8592;</span>
            Proyectos
          </Link>
          <h1 className={styles.title}>{project.title}</h1>
          {project.isFeatured && (
            <span className={styles.featured}>Proyecto Destacado</span>
          )}
        </div>
      </section>

      {/* Content */}
      <section className={styles.content}>
        <div className={styles.container}>
          <div className={styles.excerpt}>
            <p>{project.excerpt}</p>
          </div>

          <div
            className={styles.description}
            dangerouslySetInnerHTML={{ __html: project.description }}
          />

          {/* Achievements */}
          {project.achievements.length > 0 && (
            <div className={styles.achievementsSection}>
              <h2 className={styles.achievementsTitle}>Logros del Proyecto</h2>
              <ul className={styles.achievementsList}>
                {project.achievements.map((achievement) => (
                  <li key={achievement._id} className={styles.achievement}>
                    <span className={styles.achievementIcon}>
                      <span className="material-icons">check_circle</span>
                    </span>
                    <span>{achievement.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* Related Projects */}
      {relatedProjects && relatedProjects.length > 0 && (
        <section className={styles.related}>
          <div className={styles.container}>
            <h2 className={styles.relatedTitle}>Otros Proyectos</h2>
            <div className={styles.relatedGrid}>
              {relatedProjects.map((p) => {
                const relatedImageUrl = getProjectImage(p.slug, p.imageUrl);
                return (
                  <Link
                    key={p._id}
                    href={`/proyectos/${p.slug}`}
                    className={styles.relatedCard}
                  >
                    <div className={styles.relatedImage}>
                      {relatedImageUrl ? (
                        <Image
                          src={relatedImageUrl}
                          alt={p.title}
                          fill
                          className={styles.relatedImg}
                          sizes="(max-width: 768px) 100vw, 33vw"
                        />
                      ) : (
                        <div className={styles.relatedPlaceholder}>
                          <span className="material-icons">work</span>
                        </div>
                      )}
                    </div>
                    <h3 className={styles.relatedCardTitle}>{p.title}</h3>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className={styles.cta}>
        <div className={styles.container}>
          <h2 className={styles.ctaTitle}>
            ¿Quieres desarrollar un proyecto similar?
          </h2>
          <p className={styles.ctaText}>
            Contactanos para conocer como podemos ayudarte a alcanzar tus objetivos de sostenibilidad.
          </p>
          <Link href="/contacto" className={styles.ctaButton}>
            Contactanos
          </Link>
        </div>
      </section>
    </>
  );
}

function ProjectDetailSkeleton() {
  return (
    <>
      <section className={styles.heroSkeleton}>
        <Skeleton variant="rectangular" width="100%" height="100%" />
      </section>
      <section className={styles.content}>
        <div className={styles.container}>
          <Skeleton variant="text" width="100%" height={24} />
          <Skeleton variant="text" width="90%" height={24} />
          <div style={{ marginTop: '2rem' }}>
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="85%" />
          </div>
        </div>
      </section>
    </>
  );
}
