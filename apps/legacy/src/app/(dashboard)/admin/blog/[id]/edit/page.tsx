import { redirect } from 'next/navigation';
import { getSession } from '@/features/auth/lib/session';
import { EditBlogPostContent } from './EditBlogPostContent';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Editar artículo - Zephyra Consultora',
};

export default async function EditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const { id } = await params;

  return <EditBlogPostContent id={id} />;
}
