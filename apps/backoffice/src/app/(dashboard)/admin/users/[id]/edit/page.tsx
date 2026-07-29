import { redirect } from 'next/navigation';
import { getSession } from '@/features/auth/lib/session';
import { EditUserContent } from './EditUserContent';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Editar usuario - Zephyra Consultora',
};

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  if (session.role !== 'superadmin') {
    redirect('/admin');
  }

  const { id } = await params;

  return <EditUserContent id={id} currentUserId={session.userId} />;
}
