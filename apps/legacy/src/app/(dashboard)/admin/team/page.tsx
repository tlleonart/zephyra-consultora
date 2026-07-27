import { redirect } from 'next/navigation';
import { getSession } from '@/features/auth/lib/session';
import { TeamList } from '@/features/team/components/TeamList';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Equipo - Zephyra Consultora',
};

export default async function TeamPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return <TeamList adminUserId={session.userId} />;
}
