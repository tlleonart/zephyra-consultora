import { redirect } from 'next/navigation';
import { getSession } from '@/features/auth/lib/session';
import { TrashList } from '@/features/trash/components/TrashList';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Papelera - Zephyra Consultora',
};

export default async function TrashPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return <TrashList />;
}
