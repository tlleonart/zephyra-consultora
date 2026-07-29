import { redirect } from 'next/navigation';
import { getSession } from '@/features/auth/lib/session';
import { ClientForm } from '@/features/clients/components/ClientForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Agregar cliente - Zephyra Consultora',
};

export default async function NewClientPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return <ClientForm mode="create" />;
}
