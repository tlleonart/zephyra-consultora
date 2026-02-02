'use client';

import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import styles from './AlliancesSection.module.css';
import { Skeleton } from '@/components/ui/Skeleton/Skeleton';
import Image from 'next/image';
import { getAllianceLogo } from '@/lib/staticImages';

export const AlliancesSection = () => {
  const alliances = useQuery(api.alliances.listPublic);

  const isLoading = alliances === undefined;

  if (!isLoading && (!alliances || alliances.length === 0)) {
    return null;
  }

  return (
    <section id="alianzas" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>Nuestras Alianzas</h2>
          <p className={styles.description}>
            Colaboramos con organizaciones comprometidas con la sostenibilidad
          </p>
        </div>

        {isLoading ? (
          <div className={styles.grid}>
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className={styles.logoWrapper}>
                <Skeleton width={120} height={60} />
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.grid}>
            {alliances?.map((alliance) => {
              const logoUrl = getAllianceLogo(alliance.name, alliance.logoUrl);
              return (
                <div key={alliance._id} className={styles.logoWrapper}>
                  {alliance.websiteUrl ? (
                    <a
                      href={alliance.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.logoLink}
                      title={alliance.name}
                    >
                      {logoUrl ? (
                        <Image
                          src={logoUrl}
                          alt={alliance.name}
                          fill
                          className={styles.logo}
                          sizes="(max-width: 768px) 100px, 150px"
                        />
                      ) : (
                        <span className={styles.logoPlaceholder}>{alliance.name}</span>
                      )}
                    </a>
                  ) : (
                    <div className={styles.logoContainer} title={alliance.name}>
                      {logoUrl ? (
                        <Image
                          src={logoUrl}
                          alt={alliance.name}
                          fill
                          className={styles.logo}
                          sizes="(max-width: 768px) 100px, 150px"
                        />
                      ) : (
                        <span className={styles.logoPlaceholder}>{alliance.name}</span>
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
