'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '../../../../../../../convex/_generated/api';
import { Id } from '../../../../../../../convex/_generated/dataModel';
import { TeamForm } from '@/features/team/components/TeamForm';
import { Skeleton } from '@/components/ui/Skeleton';

interface EditTeamMemberContentProps {
  id: string;
}

export function EditTeamMemberContent({ id }: EditTeamMemberContentProps) {
  const router = useRouter();
  const member = useQuery(api.teamMembers.getById, { id: id as Id<'teamMembers'> });

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
        imagePositionX: member.imagePositionX,
        imagePositionY: member.imagePositionY,
        isVisible: member.isVisible,
        imageUrl: member.imageUrl,
      }}
    />
  );
}
