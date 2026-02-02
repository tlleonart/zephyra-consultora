import { redirect } from 'next/navigation';
import { getSession } from '@/features/auth/lib/session';
import { BlogForm } from '@/features/blog/components/BlogForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Nuevo artículo - Zephyra Consultora',
};

export default async function NewBlogPostPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return <BlogForm mode="create" />;
}
