import { redirect } from 'next/navigation';
import { getSession } from '@/features/auth/lib/session';
import { EditServiceContent } from './EditServiceContent';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Editar servicio - Zephyra Consultora',
};

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const { id } = await params;

  return <EditServiceContent id={id} />;
}
