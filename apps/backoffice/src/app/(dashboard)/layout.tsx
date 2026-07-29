import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Sidebar } from '@/features/dashboard/components/Sidebar';
import { Header } from '@/features/dashboard/components/Header';
import { getSession } from '@/features/auth/lib/session';

export default async function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <DashboardLayout
      sidebar={<Sidebar userRole={session.role} />}
      header={<Header userName={session.name} userRole={session.role} />}
    >
      {children}
    </DashboardLayout>
  );
}
