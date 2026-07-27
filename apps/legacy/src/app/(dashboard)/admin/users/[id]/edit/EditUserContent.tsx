'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '../../../../../../../convex/_generated/api';
import { Id } from '../../../../../../../convex/_generated/dataModel';
import { UserForm } from '@/features/users/components/UserForm';
import { Skeleton } from '@/components/ui/Skeleton';

interface EditUserContentProps {
  id: string;
  currentUserId: string;
}

export function EditUserContent({ id, currentUserId }: EditUserContentProps) {
  const router = useRouter();

  const user = useQuery(api.adminUsers.getById, {
    userId: currentUserId as Id<'adminUsers'>,
    targetId: id as Id<'adminUsers'>,
  });

  if (user === undefined) {
    return (
      <div style={{ maxWidth: '600px' }}>
        <Skeleton height={400} variant="rectangular" />
      </div>
    );
  }

  if (user === null) {
    router.push('/admin/users');
    return null;
  }

  return (
    <UserForm
      mode="edit"
      currentUserId={currentUserId as Id<'adminUsers'>}
      initialData={{
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      }}
    />
  );
}
