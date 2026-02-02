'use client';

import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import styles from './TeamSection.module.css';
import { Skeleton } from '@/components/ui/Skeleton/Skeleton';
import Image from 'next/image';
import { getTeamMemberImage } from '@/lib/staticImages';

export const TeamSection = () => {
  const teamMembers = useQuery(api.teamMembers.listPublic);

  const isLoading = teamMembers === undefined;

  return (
    <section id="equipo" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>Nuestro Equipo</h2>
          <p className={styles.description}>
            Profesionales comprometidos con el desarrollo sostenible
          </p>
        </div>

        {isLoading ? (
          <div className={styles.grid}>
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className={styles.card}>
                <Skeleton width={120} height={120} borderRadius="50%" />
                <Skeleton width="70%" height={24} style={{ marginTop: 16 }} />
                <Skeleton width="50%" height={16} style={{ marginTop: 8 }} />
                <Skeleton width="80%" height={16} style={{ marginTop: 8 }} />
              </div>
            ))}
          </div>
        ) : teamMembers && teamMembers.length > 0 ? (
          <div className={styles.grid}>
            {teamMembers.map((member) => {
              const imageUrl = getTeamMemberImage(member.name, member.imageUrl);
              return (
                <div key={member._id} className={styles.card}>
                  <div className={styles.imageWrapper}>
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={member.name}
                        fill
                        className={styles.image}
                        sizes="120px"
                      />
                    ) : (
                      <div className={styles.imagePlaceholder}>
                        <span className="material-icons">person</span>
                      </div>
                    )}
                  </div>
                  <h3 className={styles.name}>{member.name}</h3>
                  <p className={styles.role}>{member.role}</p>
                  <p className={styles.specialty}>{member.specialty}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className={styles.emptyMessage}>
            Proximamente conoceras a nuestro equipo.
          </p>
        )}
      </div>
    </section>
  );
};
