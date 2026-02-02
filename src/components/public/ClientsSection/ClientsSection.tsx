'use client';

import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import styles from './ClientsSection.module.css';
import { Skeleton } from '@/components/ui/Skeleton/Skeleton';
import Image from 'next/image';
import { getClientLogo } from '@/lib/staticImages';

export const ClientsSection = () => {
  const clients = useQuery(api.clients.listPublic);

  const isLoading = clients === undefined;

  if (!isLoading && (!clients || clients.length === 0)) {
    return null;
  }

  return (
    <section id="clientes" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>Confian en Nosotros</h2>
          <p className={styles.description}>
            Organizaciones que han confiado en nuestros servicios
          </p>
        </div>

        {isLoading ? (
          <div className={styles.grid}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className={styles.logoWrapper}>
                <Skeleton width={120} height={60} />
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.grid}>
            {clients?.map((client) => {
              const logoUrl = getClientLogo(client.name, client.logoUrl);
              return (
                <div key={client._id} className={styles.logoWrapper}>
                  {client.websiteUrl ? (
                    <a
                      href={client.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.logoLink}
                      title={client.name}
                    >
                      {logoUrl ? (
                        <Image
                          src={logoUrl}
                          alt={client.name}
                          fill
                          className={styles.logo}
                          sizes="(max-width: 768px) 100px, 150px"
                        />
                      ) : (
                        <span className={styles.logoPlaceholder}>{client.name}</span>
                      )}
                    </a>
                  ) : (
                    <div className={styles.logoContainer} title={client.name}>
                      {logoUrl ? (
                        <Image
                          src={logoUrl}
                          alt={client.name}
                          fill
                          className={styles.logo}
                          sizes="(max-width: 768px) 100px, 150px"
                        />
                      ) : (
                        <span className={styles.logoPlaceholder}>{client.name}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
