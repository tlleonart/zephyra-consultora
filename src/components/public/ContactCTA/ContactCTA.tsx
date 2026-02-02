'use client';

import Link from 'next/link';
import styles from './ContactCTA.module.css';

interface ContactCTAProps {
  title?: string;
  description?: string;
  ctaText?: string;
  ctaHref?: string;
}

export const ContactCTA = ({
  title = 'Comienza tu transformacion sostenible',
  description = 'Estamos listos para acompanarte en el camino hacia un modelo de negocio mas responsable y sostenible.',
  ctaText = 'Contactanos',
  ctaHref = '/contacto',
}: ContactCTAProps) => {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.content}>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.description}>{description}</p>
          <Link href={ctaHref} className={styles.cta}>
            {ctaText}
            <span className="material-icons">arrow_forward</span>
          </Link>
        </div>
      </div>
    </section>
  );
};
