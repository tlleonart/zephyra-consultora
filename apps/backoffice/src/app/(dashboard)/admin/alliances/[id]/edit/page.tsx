import { redirect } from 'next/navigation';
import { getSession } from '@/features/auth/lib/session';
import { EditAllianceContent } from './EditAllianceContent';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Editar alianza - Zephyra Consultora',
};

export default async function EditAlliancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const { id } = await params;

  return <EditAllianceContent id={id} />;
}
