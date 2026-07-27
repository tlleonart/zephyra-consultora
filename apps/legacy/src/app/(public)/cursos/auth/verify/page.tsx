import { Suspense } from 'react';
import { LearnerVerifyContent } from '@/features/auth-learner/components/LearnerVerifyContent';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Verificando link - Zephyra Consultora',
};

export default function LearnerVerifyPage() {
  return (
    <section style={{ padding: '4rem 1rem', maxWidth: '40rem', margin: '0 auto' }}>
      <Suspense fallback={<p>Cargando…</p>}>
        <LearnerVerifyContent />
      </Suspense>
    </section>
  );
}
