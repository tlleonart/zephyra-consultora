import { redirect } from 'next/navigation';
import { getSession } from '@/features/auth/lib/session';
import { AllianceForm } from '@/features/alliances/components/AllianceForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Agregar alianza - Zephyra Consultora',
};

export default async function NewAlliancePage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return <AllianceForm mode="create" />;
}
