import { redirect } from 'next/navigation';
import { getSession } from '@/features/auth/lib/session';
import { UserList } from '@/features/users/components/UserList';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Administradores - Zephyra Consultora',
};

export default async function UsersPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  // Only superadmins can access this page
  if (session.role !== 'superadmin') {
    redirect('/admin');
  }

  return <UserList currentUserId={session.userId} />;
}
