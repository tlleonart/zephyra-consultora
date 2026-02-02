'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '../../../../../../../convex/_generated/api';
import { Id } from '../../../../../../../convex/_generated/dataModel';
import { ClientForm } from '@/features/clients/components/ClientForm';
import { Skeleton } from '@/components/ui/Skeleton';

export default function EditClientPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as Id<'clients'>;

  const client = useQuery(api.clients.getById, { id });

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
