"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import Image from "next/image";
import { api } from "../../../convex/_generated/api";
import { Skeleton } from "@/components/ui/Skeleton";
import { getProjectImage } from "@/lib/staticImages";
import styles from "@/app/(public)/proyectos/ProyectosPage.module.css";

export function ProyectosPageContent() {
  return (
    <>
      <section className={styles.hero}>
        <div className={styles.container}>
          <h1 className={styles.title}>Impacto en acción</h1>
          <p className={styles.subtitle}>
            Transformaciones reales en organizaciones que decidieron integrar el
            impacto como motor de su crecimiento.
          </p>
        </div>
      </section>

      <section className={styles.content}>
        <div className={styles.container}>
          <ProjectsGrid />
        </div>
      </section>
    </>
  );
}

function ProjectsGrid() {
  const projects = useQuery(api.projects.listPublic);

  if (projects === undefined) {
    return <ProjectsGridSkeleton />;
  }

  if (projects.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>
          Proximamente compartiremos nuestros proyectos.
        </p>
      </div>
    );
  }

  return (
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
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function ProjectsGridSkeleton() {
  return (
    <div className={styles.grid}>
      {Array.from({ length: 6 }).map((_, index) => (
        <ProjectCardSkeleton key={index} />
      ))}
    </div>
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
