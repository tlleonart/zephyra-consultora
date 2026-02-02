'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '../../../../../../../convex/_generated/api';
import { Id } from '../../../../../../../convex/_generated/dataModel';
import { ProjectForm } from '@/features/projects/components/ProjectForm';
import { Skeleton } from '@/components/ui/Skeleton';

export default function EditProjectPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as Id<'projects'>;

  const project = useQuery(api.projects.getById, { id });

  if (project === undefined) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <Skeleton height={300} variant="rectangular" />
          <Skeleton height={300} variant="rectangular" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <Skeleton height={200} variant="rectangular" />
          <Skeleton height={200} variant="rectangular" />
        </div>
      </div>
    );
  }

  if (project === null) {
    router.push('/admin/projects');
    return null;
  }

  return (
    <ProjectForm
      mode="edit"
      initialData={{
        _id: project._id,
        title: project.title,
        slug: project.slug,
        excerpt: project.excerpt,
        description: project.description,
        imageStorageId: project.imageStorageId,
        isFeatured: project.isFeatured,
        achievements: project.achievements,
      }}
    />
  );
}
