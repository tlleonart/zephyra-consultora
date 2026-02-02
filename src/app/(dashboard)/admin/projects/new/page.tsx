import { redirect } from 'next/navigation';
import { getSession } from '@/features/auth/lib/session';
import { ProjectForm } from '@/features/projects/components/ProjectForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Nuevo proyecto - Zephyra Consultora',
};

export default async function NewProjectPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return <ProjectForm mode="create" />;
}
