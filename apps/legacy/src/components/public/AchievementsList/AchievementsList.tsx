'use client';

import { cn } from '@/lib/cn';
import styles from './AchievementsList.module.css';

interface Achievement {
  _id: string;
  description: string;
  displayOrder: number;
}

interface AchievementsListProps {
  achievements: Achievement[];
  className?: string;
  animate?: boolean;
}

export const AchievementsList = ({
  achievements,
  className,
  animate = true,
}: AchievementsListProps) => {
  if (!achievements || achievements.length === 0) {
    return null;
  }

  return (
    <div className={cn(styles.container, className)}>
      <h2 className={styles.title}>Logros del proyecto</h2>
      <ul className={styles.list}>
        {achievements
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((achievement, index) => (
            <li
              key={achievement._id}
              className={cn(styles.item, animate && styles.animate)}
              style={{ animationDelay: animate ? `${index * 100}ms` : undefined }}
            >
              <span className={styles.icon}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <span className={styles.text}>{achievement.description}</span>
            </li>
          ))}
      </ul>
    </div>
  );
};
