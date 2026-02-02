import { BlogPostContent } from '@/components/public/BlogPostContent';
import styles from './BlogPost.module.css';

export const dynamic = 'force-dynamic';

export default function BlogPostPage() {
  return (
    <main className={styles.main}>
      <BlogPostContent />
    </main>
  );
}
