import { redirect } from 'next/navigation';
import { getSession } from '@/features/auth/lib/session';
import { EditClientContent } from './EditClientContent';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Editar cliente - Zephyra Consultora',
};

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const { id } = await params;

  return <EditClientContent id={id} />;
}
