import { ReactNode } from 'react';
import Link from 'next/link';
import styles from './StatsCard.module.css';

export interface StatsCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: ReactNode;
  href?: string;
  color?: 'primary' | 'success' | 'warning' | 'secondary';
}

export const StatsCard = ({
  title,
  value,
  subtitle,
  icon,
  href,
  color = 'primary',
}: StatsCardProps) => {
  const content = (
    <div className={`${styles.card} ${styles[color]}`}>
      <div className={styles.iconWrapper}>{icon}</div>
      <div className={styles.content}>
        <span className={styles.title}>{title}</span>
        <span className={styles.value}>{value}</span>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className={styles.link}>
        {content}
      </Link>
    );
  }

  return content;
};
