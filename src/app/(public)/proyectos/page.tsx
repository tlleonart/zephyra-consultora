import { ProyectosPageContent } from '@/components/public/ProyectosPageContent';
import styles from './ProyectosPage.module.css';

export const dynamic = 'force-dynamic';

export default function ProyectosPage() {
  return (
    <main className={styles.main}>
      <ProyectosPageContent />
    </main>
  );
}
