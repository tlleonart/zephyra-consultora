import { redirect } from 'next/navigation';
import { getSession } from '@/features/auth/lib/session';
import { EditServiceBlockContent } from './EditServiceBlockContent';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Editar bloque - Zephyra Consultora',
};

export default async function EditServiceBlockPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const { id } = await params;

  return <EditServiceBlockContent id={id} />;
}
