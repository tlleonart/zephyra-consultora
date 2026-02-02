import { ProyectoDetailContent } from '@/components/public/ProyectoDetailContent';
import styles from './ProyectoDetail.module.css';

export const dynamic = 'force-dynamic';

export default function ProyectoDetailPage() {
  return (
    <main className={styles.main}>
      <ProyectoDetailContent />
    </main>
  );
}
