'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '../../../../../../../convex/_generated/api';
import { Id } from '../../../../../../../convex/_generated/dataModel';
import { UserForm } from '@/features/users/components/UserForm';
import { Skeleton } from '@/components/ui/Skeleton';
import { useEffect, useState } from 'react';

export default function EditUserPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as Id<'adminUsers'>;

  // Get current user from session - we need to pass this to the form
  const [currentUserId, setCurrentUserId] = useState<Id<'adminUsers'> | null>(null);

  useEffect(() => {
    // Get session from cookie (client-side check)
    const checkSession = async () => {
      const response = await fetch('/api/auth/session');
      if (response.ok) {
        const data = await response.json();
        if (data.userId) {
          setCurrentUserId(data.userId);
        } else {
          router.push('/login');
        }
      } else {
        router.push('/login');
      }
    };
    checkSession();
  }, [router]);

  const user = useQuery(
    api.adminUsers.getById,
    currentUserId ? { userId: currentUserId, targetId: id } : 'skip'
  );

  if (!currentUserId || user === undefined) {
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
      currentUserId={currentUserId}
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
