'use client';

import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import styles from './ServicesSection.module.css';
import { Skeleton } from '@/components/ui/Skeleton/Skeleton';

export const ServicesSection = () => {
  const services = useQuery(api.services.listPublic);

  const isLoading = services === undefined;

  return (
    <section id="servicios" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>Nuestros Servicios</h2>
          <p className={styles.description}>
            Ofrecemos soluciones integrales para impulsar la sostenibilidad en tu organizacion
          </p>
        </div>

        {isLoading ? (
          <div className={styles.grid}>
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className={styles.card}>
                <Skeleton width={48} height={48} borderRadius="50%" />
                <Skeleton width="70%" height={24} style={{ marginTop: 16 }} />
                <Skeleton width="100%" height={60} style={{ marginTop: 8 }} />
              </div>
            ))}
          </div>
        ) : services && services.length > 0 ? (
          <div className={styles.grid}>
            {services.map((service) => (
              <div key={service._id} className={styles.card}>
                <div className={styles.iconWrapper}>
                  <span className="material-icons">{service.iconName}</span>
                </div>
                <h3 className={styles.cardTitle}>{service.title}</h3>
                <p className={styles.cardDescription}>{service.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.emptyMessage}>
            Proximamente compartiremos nuestros servicios.
          </p>
        )}
      </div>
    </section>
  );
};
