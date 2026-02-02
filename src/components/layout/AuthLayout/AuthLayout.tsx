import { ReactNode } from 'react';
import styles from './AuthLayout.module.css';

export interface AuthLayoutProps {
  children: ReactNode;
}

export const AuthLayout = ({ children }: AuthLayoutProps) => {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.logo}>
          <h1 className={styles.logoText}>Zephyra</h1>
          <span className={styles.logoTagline}>Consultora</span>
        </div>
        <div className={styles.card}>{children}</div>
      </div>
    </div>
  );
};
