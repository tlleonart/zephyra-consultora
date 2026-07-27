"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import styles from "./ServicesSection.module.css";
import { Skeleton } from "@/components/ui/Skeleton/Skeleton";
import Image from "next/image";

function getBalancedColumns(count: number): number {
  if (count <= 3) return count;
  if (count === 4) return 2;
  return 3;
}

export const ServicesSection = () => {
  const blocks = useQuery(api.serviceBlocks.listPublic);

  const isLoading = blocks === undefined;

  return (
    <section id="servicios" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>Nuestros Servicios</h2>
          <p className={styles.description}>
            Diseñamos soluciones a medida para que cada organización pueda
            integrar el impacto social y ambiental en el corazón de su
            estrategia.
          </p>
        </div>

        {isLoading ? (
          <div className={styles.blockList}>
            {[1, 2, 3].map((n) => (
              <div key={n} className={styles.block}>
                <div className={styles.blockBannerPlaceholder}>
                  <Skeleton width="50%" height={28} />
                  <Skeleton width="70%" height={18} style={{ marginTop: 8 }} />
                </div>
                <div className={styles.servicesGrid}>
                  {[1, 2, 3].map((m) => (
                    <div key={m} className={styles.card}>
                      <Skeleton
                        width={64}
                        height={64}
                        borderRadius="50%"
                        style={{ margin: "0 auto" }}
                      />
                      <Skeleton
                        width="70%"
                        height={24}
                        style={{ margin: "16px auto 0" }}
                      />
                      <Skeleton
                        width="100%"
                        height={48}
                        style={{ marginTop: 8 }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : blocks && blocks.length > 0 ? (
          <div className={styles.blockList}>
            {blocks.map((block) => (
              <div key={block._id} className={styles.block}>
                {block.imageUrl ? (
                  <div className={styles.blockBanner}>
                    <Image
                      src={block.imageUrl}
                      alt={block.title}
                      fill
                      className={styles.blockImage}
                      sizes="(max-width: 768px) 100vw, 1200px"
                    />
                    <div className={styles.blockOverlay}>
                      <h3 className={styles.blockTitle}>{block.title}</h3>
                      <p className={styles.blockSubtitle}>{block.subtitle}</p>
                    </div>
                  </div>
                ) : (
                  <div className={styles.blockBannerPlaceholder}>
                    <h3 className={styles.blockTitle}>{block.title}</h3>
                    <p className={styles.blockSubtitle}>{block.subtitle}</p>
                  </div>
                )}
                <div
                  className={styles.servicesGrid}
                  style={{ '--service-columns': getBalancedColumns(block.services.length) } as React.CSSProperties}
                >
                  {block.services.map((service) => (
                    <div key={service._id} className={styles.card} tabIndex={0}>
                      <div className={styles.iconWrapper}>
                        <span className="material-icons">
                          {service.iconName}
                        </span>
                      </div>
                      <h4 className={styles.cardTitle}>{service.title}</h4>
                      <p className={styles.cardDescription}>
                        {service.description}
                      </p>
                    </div>
                  ))}
                </div>
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
