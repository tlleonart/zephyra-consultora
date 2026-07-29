import { redirect } from 'next/navigation';
import { getSession } from '@/features/auth/lib/session';
import { TeamForm } from '@/features/team/components/TeamForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Nuevo miembro - Zephyra Consultora',
};

export default async function NewTeamMemberPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return <TeamForm mode="create" />;
}
