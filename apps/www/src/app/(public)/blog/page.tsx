import { BlogPageContent } from '@/components/public/BlogPageContent';
import styles from './BlogPage.module.css';

export const dynamic = 'force-dynamic';

export default function BlogPage() {
  return (
    <main className={styles.main}>
      <BlogPageContent />
    </main>
  );
}
