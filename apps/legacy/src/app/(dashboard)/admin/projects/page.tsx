import { redirect } from 'next/navigation';
import { getSession } from '@/features/auth/lib/session';
import { ProjectList } from '@/features/projects/components/ProjectList';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Proyectos - Zephyra Consultora',
};

export default async function ProjectsPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return <ProjectList adminUserId={session.userId} />;
}
