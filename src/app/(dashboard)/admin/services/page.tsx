import { redirect } from 'next/navigation';
import { getSession } from '@/features/auth/lib/session';
import { ServiceList } from '@/features/services/components/ServiceList';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Servicios - Zephyra Consultora',
};

export default async function ServicesPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return <ServiceList adminUserId={session.userId} />;
}
