import { redirect } from 'next/navigation';
import { getSession } from '@/features/auth/lib/session';
import { ClientList } from '@/features/clients/components/ClientList';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Clientes - Zephyra Consultora',
};

export default async function ClientsPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return <ClientList adminUserId={session.userId} />;
}
