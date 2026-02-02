'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '../../../../../../../convex/_generated/api';
import { Id } from '../../../../../../../convex/_generated/dataModel';
import { TeamForm } from '@/features/team/components/TeamForm';
import { Skeleton } from '@/components/ui/Skeleton';

export default function EditTeamMemberPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as Id<'teamMembers'>;

  const member = useQuery(api.teamMembers.getById, { id });

  if (member === undefined) {
    return (
      <div style={{ maxWidth: 800 }}>
        <Skeleton height={400} variant="rectangular" />
      </div>
    );
  }

  if (member === null) {
    router.push('/admin/team');
    return null;
  }

  return (
    <TeamForm
      mode="edit"
      initialData={{
        _id: member._id,
        name: member.name,
        role: member.role,
        specialty: member.specialty,
        imageStorageId: member.imageStorageId,
        isVisible: member.isVisible,
      }}
    />
  );
}
