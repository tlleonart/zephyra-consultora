import { redirect } from 'next/navigation';
import { getSession } from '@/features/auth/lib/session';
import { DashboardHome } from './DashboardHome';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dashboard - Zephyra Consultora',
};

export default async function AdminPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return <DashboardHome userId={session.userId} />;
}
