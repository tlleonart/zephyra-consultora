import { redirect } from 'next/navigation';
import { getSession } from '@/features/auth/lib/session';
import { EditProjectContent } from './EditProjectContent';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Editar proyecto - Zephyra Consultora',
};

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const { id } = await params;

  return <EditProjectContent id={id} />;
}
