'use client';

import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import styles from './TrustSection.module.css';
import { Skeleton } from '@/components/ui/Skeleton/Skeleton';
import Image from 'next/image';
import { getClientLogo, getAllianceLogo } from '@/lib/staticImages';

interface LogoItem {
  _id: string;
  name: string;
  logoUrl?: string | null;
  websiteUrl?: string | null;
}

function LogoRow({ items, getLogoUrl }: { items: LogoItem[]; getLogoUrl: (name: string, logoUrl?: string | null) => string | null }) {
  return (
    <div className={styles.row}>
      <div className={styles.grid}>
        {items.map((item) => {
          const logoUrl = getLogoUrl(item.name, item.logoUrl);
          return (
            <div key={item._id} className={styles.logoWrapper}>
              {item.websiteUrl ? (
                <a
                  href={item.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.logoLink}
                  title={item.name}
                >
                  {logoUrl ? (
                    <Image
                      src={logoUrl}
                      alt={item.name}
                      fill
                      className={styles.logo}
                      sizes="(max-width: 768px) 100px, 150px"
                    />
                  ) : (
                    <span className={styles.logoPlaceholder}>{item.name}</span>
                  )}
                </a>
              ) : (
                <div className={styles.logoContainer} title={item.name}>
                  {logoUrl ? (
                    <Image
                      src={logoUrl}
                      alt={item.name}
                      fill
                      className={styles.logo}
                      sizes="(max-width: 768px) 100px, 150px"
                    />
                  ) : (
                    <span className={styles.logoPlaceholder}>{item.name}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const TrustSection = () => {
  const clients = useQuery(api.clients.listPublic);
  const alliances = useQuery(api.alliances.listPublic);

  const clientsLoading = clients === undefined;
  const alliancesLoading = alliances === undefined;
  const isLoading = clientsLoading || alliancesLoading;

  const hasClients = clients && clients.length > 0;
  const hasAlliances = alliances && alliances.length > 0;

  if (!isLoading && !hasClients && !hasAlliances) {
    return null;
  }

  return (
    <section id="confianza" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>Confían en nosotros</h2>
          <p className={styles.description}>
            Trabajamos con organizaciones comprometidas con la sostenibilidad
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
          <>
            {hasClients && (
              <LogoRow items={clients} getLogoUrl={getClientLogo} />
            )}
            {hasAlliances && (
              <LogoRow items={alliances} getLogoUrl={getAllianceLogo} />
            )}
          </>
        )}
      </div>
    </section>
  );
};
