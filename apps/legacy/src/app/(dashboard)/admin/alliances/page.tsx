import { redirect } from 'next/navigation';
import { getSession } from '@/features/auth/lib/session';
import { AllianceList } from '@/features/alliances/components/AllianceList';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Alianzas - Zephyra Consultora',
};

export default async function AlliancesPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return <AllianceList adminUserId={session.userId} />;
}
