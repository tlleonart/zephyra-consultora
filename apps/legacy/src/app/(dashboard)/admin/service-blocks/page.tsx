import { redirect } from 'next/navigation';
import { getSession } from '@/features/auth/lib/session';
import { ServiceBlockList } from '@/features/services/components/ServiceBlockList';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Bloques de servicios - Zephyra Consultora',
};

export default async function ServiceBlocksPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return <ServiceBlockList adminUserId={session.userId} />;
}
