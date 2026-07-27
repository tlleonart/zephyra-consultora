'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '../../../../../../../convex/_generated/api';
import { Id } from '../../../../../../../convex/_generated/dataModel';
import { AllianceForm } from '@/features/alliances/components/AllianceForm';
import { Skeleton } from '@/components/ui/Skeleton';

interface EditAllianceContentProps {
  id: string;
}

export function EditAllianceContent({ id }: EditAllianceContentProps) {
  const router = useRouter();
  const alliance = useQuery(api.alliances.getById, { id: id as Id<'alliances'> });

  if (alliance === undefined) {
    return (
      <div style={{ maxWidth: '700px' }}>
        <Skeleton height={350} variant="rectangular" />
      </div>
    );
  }

  if (alliance === null) {
    router.push('/admin/alliances');
    return null;
  }

  return (
    <AllianceForm
      mode="edit"
      initialData={{
        _id: alliance._id,
        name: alliance.name,
        logoStorageId: alliance.logoStorageId,
        websiteUrl: alliance.websiteUrl,
      }}
    />
  );
}
