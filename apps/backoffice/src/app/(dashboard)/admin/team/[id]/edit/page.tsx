import { redirect } from 'next/navigation';
import { getSession } from '@/features/auth/lib/session';
import { EditTeamMemberContent } from './EditTeamMemberContent';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Editar miembro - Zephyra Consultora',
};

export default async function EditTeamMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const { id } = await params;

  return <EditTeamMemberContent id={id} />;
}
