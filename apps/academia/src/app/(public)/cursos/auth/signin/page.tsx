import { Suspense } from 'react';
import { LearnerSigninForm } from '@/features/auth-learner/components/LearnerSigninForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: "Iniciá sesión",
  description: 'Accedé a tus cursos en Zephyra.',
};

export default function LearnerSigninPage() {
  return (
    <section style={{ padding: '4rem 1rem', maxWidth: '40rem', margin: '0 auto' }}>
      <Suspense fallback={null}>
        <LearnerSigninForm />
      </Suspense>
    </section>
  );
}
