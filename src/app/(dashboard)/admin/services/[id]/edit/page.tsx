'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '../../../../../../../convex/_generated/api';
import { Id } from '../../../../../../../convex/_generated/dataModel';
import { ServiceForm } from '@/features/services/components/ServiceForm';
import { Skeleton } from '@/components/ui/Skeleton';

export default function EditServicePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as Id<'services'>;

  const service = useQuery(api.services.getById, { id });

  if (service === undefined) {
    return (
      <div style={{ maxWidth: '800px' }}>
        <Skeleton height={400} variant="rectangular" />
      </div>
    );
  }

  if (service === null) {
    router.push('/admin/services');
    return null;
  }

  return (
    <ServiceForm
      mode="edit"
      initialData={{
        _id: service._id,
        title: service.title,
        description: service.description,
        iconName: service.iconName,
        isActive: service.isActive,
      }}
    />
  );
}
