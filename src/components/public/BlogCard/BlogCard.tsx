'use client';

import Link from 'next/link';
import Image from 'next/image';
import styles from './BlogCard.module.css';
import { getBlogCoverImage } from '@/lib/staticImages';

interface BlogCardProps {
  slug: string;
  title: string;
  excerpt: string;
  coverUrl: string | null;
  authorName: string;
  publishedAt?: number;
  createdAt: number;
}

export const BlogCard = ({
  slug,
  title,
  excerpt,
  coverUrl,
  authorName,
  publishedAt,
  createdAt,
}: BlogCardProps) => {
  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(timestamp));
  };

  const displayDate = publishedAt || createdAt;
  const imageUrl = getBlogCoverImage(slug, coverUrl);

  return (
    <Link href={`/blog/${slug}`} className={styles.card}>
      <div className={styles.imageWrapper}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            className={styles.image}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className={styles.placeholder}>
            <span className={styles.placeholderIcon}>📝</span>
          </div>
        )}
      </div>
      <div className={styles.content}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.excerpt}>{excerpt}</p>
        <div className={styles.meta}>
          <span className={styles.author}>{authorName}</span>
          <span className={styles.separator} />
          <span className={styles.date}>{formatDate(displayDate)}</span>
        </div>
      </div>
    </Link>
  );
};
