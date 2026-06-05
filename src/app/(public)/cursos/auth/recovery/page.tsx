import { LearnerSignupForm } from '@/features/auth-learner/components/LearnerSignupForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Recuperá tu acceso - Zephyra Consultora',
  description: 'Te enviamos un link para recuperar el acceso a tu cuenta.',
};

export default function LearnerRecoveryPage() {
  return (
    <section style={{ padding: '4rem 1rem', maxWidth: '40rem', margin: '0 auto' }}>
      <LearnerSignupForm
        purpose="learner_recovery"
        title="¿Perdiste el acceso?"
        subtitle="Ingresá tu email y te enviamos un link para recuperarlo."
        buttonLabel="Recibir link de recuperación"
      />
    </section>
  );
}
