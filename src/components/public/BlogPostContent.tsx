'use client';

import { useParams } from 'next/navigation';
import { useQuery } from 'convex/react';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '../../../convex/_generated/api';
import { BlogContent } from '@/components/public/BlogContent';
import { Skeleton } from '@/components/ui/Skeleton';
import { getBlogCoverImage } from '@/lib/staticImages';
import styles from '@/app/(public)/blog/[slug]/BlogPost.module.css';

export function BlogPostContent() {
  const params = useParams();
  const slug = params.slug as string;

  const post = useQuery(api.blogPosts.getBySlug, { slug });

  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(timestamp));
  };

  // Loading state
  if (post === undefined) {
    return <BlogPostSkeleton />;
  }

  // Not found state
  if (post === null) {
    return (
      <div className={styles.notFound}>
        <h1 className={styles.notFoundTitle}>Articulo no encontrado</h1>
        <p className={styles.notFoundText}>
          El articulo que buscas no existe o ha sido eliminado.
        </p>
        <Link href="/blog" className={styles.backLink}>
          Volver al blog
        </Link>
      </div>
    );
  }

  const displayDate = post.publishedAt || post.createdAt;
  const coverImageUrl = getBlogCoverImage(slug, post.coverUrl);

  return (
    <>
      {/* Cover Image */}
      {coverImageUrl && (
        <div className={styles.coverWrapper}>
          <Image
            src={coverImageUrl}
            alt={post.title}
            fill
            priority
            className={styles.coverImage}
            sizes="100vw"
          />
          <div className={styles.coverOverlay} />
        </div>
      )}

      <article className={styles.article}>
        <div className={styles.container}>
          {/* Back link */}
          <Link href="/blog" className={styles.backLinkHeader}>
            <span className={styles.backArrow}>&#8592;</span>
            Volver al blog
          </Link>

          {/* Header */}
          <header className={styles.header}>
            <h1 className={styles.title}>{post.title}</h1>
            <div className={styles.meta}>
              <span className={styles.author}>{post.authorName}</span>
              <span className={styles.separator}>|</span>
              <time className={styles.date}>{formatDate(displayDate)}</time>
            </div>
          </header>

          {/* Content */}
          <div className={styles.contentWrapper}>
            <BlogContent html={post.content} />
          </div>

          {/* Footer */}
          <footer className={styles.footer}>
            <Link href="/blog" className={styles.backLink}>
              <span className={styles.backArrow}>&#8592;</span>
              Volver al blog
            </Link>
          </footer>
        </div>
      </article>
    </>
  );
}

function BlogPostSkeleton() {
  return (
    <>
      <div className={styles.coverSkeleton}>
        <Skeleton variant="rectangular" width="100%" height="100%" />
      </div>
      <article className={styles.article}>
        <div className={styles.container}>
          <Skeleton variant="text" width="100px" />
          <header className={styles.header}>
            <Skeleton variant="text" width="80%" height={48} />
            <div className={styles.metaSkeleton}>
              <Skeleton variant="text" width="120px" />
              <Skeleton variant="text" width="100px" />
            </div>
          </header>
          <div className={styles.contentWrapper}>
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="90%" />
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="85%" />
            <div style={{ marginTop: '2rem' }}>
              <Skeleton variant="text" width="60%" height={32} />
            </div>
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="70%" />
          </div>
        </div>
      </article>
    </>
  );
}
