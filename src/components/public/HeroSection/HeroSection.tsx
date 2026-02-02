'use client';

import Link from 'next/link';
import styles from './HeroSection.module.css';

interface HeroSectionProps {
  title?: string;
  subtitle?: string;
  ctaText?: string;
  ctaHref?: string;
  backgroundImage?: string;
}

export const HeroSection = ({
  title = 'Construyendo un futuro sostenible',
  subtitle = 'Acompañamos a organizaciones en su transformación hacia prácticas más responsables con el medio ambiente y la sociedad.',
  ctaText = 'Conocé nuestros servicios',
  ctaHref = '#servicios',
  backgroundImage = '/images/hero-bg.jpg',
}: HeroSectionProps) => {
  return (
    <section className={styles.hero}>
      <div
        className={styles.background}
        style={{ backgroundImage: `url(${backgroundImage})` }}
      />
      <div className={styles.overlay} />
      <div className={styles.content}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
        <Link href={ctaHref} className={styles.cta}>
          {ctaText}
        </Link>
      </div>
    </section>
  );
};
