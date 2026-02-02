import { redirect } from 'next/navigation';
import { getSession } from '@/features/auth/lib/session';
import { UserForm } from '@/features/users/components/UserForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Nuevo administrador - Zephyra Consultora',
};

export default async function NewUserPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  // Only superadmins can access this page
  if (session.role !== 'superadmin') {
    redirect('/admin');
  }

  return <UserForm mode="create" currentUserId={session.userId} />;
}
