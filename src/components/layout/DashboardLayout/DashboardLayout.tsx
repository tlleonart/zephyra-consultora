import { ReactNode } from 'react';
import styles from './DashboardLayout.module.css';

export interface DashboardLayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
  header: ReactNode;
}

export const DashboardLayout = ({ children, sidebar, header }: DashboardLayoutProps) => {
  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>{sidebar}</aside>
      <div className={styles.main}>
        <header className={styles.header}>{header}</header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
};
