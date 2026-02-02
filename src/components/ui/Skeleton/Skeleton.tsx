import { cn } from '@/lib/cn';
import styles from './Skeleton.module.css';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'circular' | 'rectangular';
  className?: string;
  borderRadius?: string | number;
  style?: React.CSSProperties;
}

export const Skeleton = ({
  width,
  height,
  variant = 'text',
  className,
  borderRadius,
  style,
}: SkeletonProps) => {
  return (
    <div
      className={cn(styles.skeleton, styles[variant], className)}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: borderRadius
          ? typeof borderRadius === 'number'
            ? `${borderRadius}px`
            : borderRadius
          : undefined,
        ...style,
      }}
    />
  );
};

// Preset skeletons for common use cases
export const SkeletonText = ({ lines = 3 }: { lines?: number }) => {
  return (
    <div className={styles.textContainer}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          width={i === lines - 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  );
};

export const SkeletonCard = () => {
  return (
    <div className={styles.cardSkeleton}>
      <Skeleton variant="rectangular" height={200} />
      <div className={styles.cardContent}>
        <Skeleton variant="text" width="80%" />
        <Skeleton variant="text" width="60%" />
      </div>
    </div>
  );
};

export const SkeletonAvatar = ({ size = 40 }: { size?: number }) => {
  return <Skeleton variant="circular" width={size} height={size} />;
};

export const SkeletonTableRow = ({ columns = 4 }: { columns?: number }) => {
  return (
    <tr className={styles.tableRow}>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className={styles.tableCell}>
          <Skeleton variant="text" width="80%" />
        </td>
      ))}
    </tr>
  );
};
