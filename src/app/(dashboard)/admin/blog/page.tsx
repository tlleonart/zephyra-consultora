import { redirect } from 'next/navigation';
import { getSession } from '@/features/auth/lib/session';
import { BlogList } from '@/features/blog/components/BlogList';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Blog - Zephyra Consultora',
};

export default async function BlogPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return <BlogList adminUserId={session.userId} />;
}
