import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getLearnerSession } from '@/features/auth-learner/lib/session';
import { LearnerSetPasswordForm } from '@/features/auth-learner/components/LearnerSetPasswordForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: "Configurá tu contraseña",
};

export default async function LearnerSetPasswordPage() {
  // Server-side gate: this surface requires a learner session. A missing or
  // invalid 'session-learner' cookie bounces to signin (admin cookies do NOT
  // satisfy this — distinct verify path + distinct secret).
  const session = await getLearnerSession();
  if (!session) {
    redirect('/cursos/auth/signin');
  }

  return (
    <section style={{ padding: '4rem 1rem', maxWidth: '40rem', margin: '0 auto' }}>
      <Suspense fallback={null}>
        <LearnerSetPasswordForm />
      </Suspense>
    </section>
  );
}
