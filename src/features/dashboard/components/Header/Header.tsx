'use client';

import { Button } from '@/components/ui/Button';
import { logout } from '@/features/auth/actions/logout';
import styles from './Header.module.css';

interface HeaderProps {
  userName: string;
  userRole: 'superadmin' | 'admin';
}

export const Header = ({ userName, userRole }: HeaderProps) => {
  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        {/* Breadcrumb or page title could go here */}
      </div>

      <div className={styles.right}>
        <div className={styles.userInfo}>
          <span className={styles.userName}>{userName}</span>
          <span className={styles.userRole}>
            {userRole === 'superadmin' ? 'Super Admin' : 'Admin'}
          </span>
        </div>

        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Salir
        </Button>
      </div>
    </header>
  );
};
