'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '../../../../../../../convex/_generated/api';
import { Id } from '../../../../../../../convex/_generated/dataModel';
import { ClientForm } from '@/features/clients/components/ClientForm';
import { Skeleton } from '@/components/ui/Skeleton';

interface EditClientContentProps {
  id: string;
}

export function EditClientContent({ id }: EditClientContentProps) {
  const router = useRouter();
  const client = useQuery(api.clients.getById, { id: id as Id<'clients'> });

  if (client === undefined) {
    return (
      <div style={{ maxWidth: '700px' }}>
        <Skeleton height={350} variant="rectangular" />
      </div>
    );
  }

  if (client === null) {
    router.push('/admin/clients');
    return null;
  }

  return (
    <ClientForm
      mode="edit"
      initialData={{
        _id: client._id,
        name: client.name,
        logoStorageId: client.logoStorageId,
        websiteUrl: client.websiteUrl,
      }}
    />
  );
}
