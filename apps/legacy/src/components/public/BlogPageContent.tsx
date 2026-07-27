"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { BlogCard } from "@/components/public/BlogCard";
import { Skeleton } from "@/components/ui/Skeleton";
import styles from "@/app/(public)/blog/BlogPage.module.css";

export function BlogPageContent() {
  return (
    <>
      <section className={styles.hero}>
        <div className={styles.container}>
          <h1 className={styles.title}>Perspectivas</h1>
          <p className={styles.subtitle}>
            Miradas estratégicas y herramientas útiles para integrar la
            sostenibilidad y el triple impacto en las organizaciones.
          </p>
        </div>
      </section>

      <section className={styles.content}>
        <div className={styles.container}>
          <BlogGrid />
        </div>
      </section>
    </>
  );
}

function BlogGrid() {
  const posts = useQuery(api.blogPosts.listPublished, {});

  if (posts === undefined) {
    return <BlogGridSkeleton />;
  }

  if (posts.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>
          Aun no hay articulos publicados. Vuelve pronto para ver nuestro
          contenido.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {posts.map((post) => (
        <BlogCard
          key={post._id}
          slug={post.slug}
          title={post.title}
          excerpt={post.excerpt}
          coverUrl={post.coverUrl}
          authorName={post.authorName}
          publishedAt={post.publishedAt}
          createdAt={post.createdAt}
        />
      ))}
    </div>
  );
}

function BlogGridSkeleton() {
  return (
    <div className={styles.grid}>
      {Array.from({ length: 6 }).map((_, index) => (
        <BlogCardSkeleton key={index} />
      ))}
    </div>
  );
}

function BlogCardSkeleton() {
  return (
    <div className={styles.cardSkeleton}>
      <Skeleton variant="rectangular" width="100%" height={200} />
      <div className={styles.cardSkeletonContent}>
        <Skeleton variant="text" width="90%" />
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="75%" />
        <div className={styles.cardSkeletonMeta}>
          <Skeleton variant="text" width="100px" />
          <Skeleton variant="text" width="80px" />
        </div>
      </div>
    </div>
  );
}
