import { redirect } from 'next/navigation';
import { getSession } from '@/features/auth/lib/session';
import { ServiceBlockForm } from '@/features/services/components/ServiceBlockForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Nuevo bloque - Zephyra Consultora',
};

export default async function NewServiceBlockPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return <ServiceBlockForm mode="create" />;
}
