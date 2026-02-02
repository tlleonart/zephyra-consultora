import { redirect } from 'next/navigation';
import { getSession } from '@/features/auth/lib/session';
import { ServiceForm } from '@/features/services/components/ServiceForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Nuevo servicio - Zephyra Consultora',
};

export default async function NewServicePage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return <ServiceForm mode="create" />;
}
