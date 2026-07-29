import { Suspense } from 'react';
import { ResetPasswordForm } from '@/features/auth/components/ResetPasswordForm';
import { Skeleton } from '@zephyra/ui';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Nueva Contraseña - Zephyra Consultora',
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Skeleton height={300} />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
