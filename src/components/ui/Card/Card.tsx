import { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import styles from './Card.module.css';

export interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card = ({ children, className, padding = 'md' }: CardProps) => {
  return (
    <div className={cn(styles.card, styles[`padding-${padding}`], className)}>
      {children}
    </div>
  );
};

export interface CardHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export const CardHeader = ({ title, description, action }: CardHeaderProps) => {
  return (
    <div className={styles.header}>
      <div className={styles.headerText}>
        <h3 className={styles.title}>{title}</h3>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {action && <div className={styles.headerAction}>{action}</div>}
    </div>
  );
};

export interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export const CardContent = ({ children, className }: CardContentProps) => {
  return <div className={cn(styles.content, className)}>{children}</div>;
};

export interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export const CardFooter = ({ children, className }: CardFooterProps) => {
  return <div className={cn(styles.footer, className)}>{children}</div>;
};
