import { LearnerSignupForm } from '@/features/auth-learner/components/LearnerSignupForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: "Empezá tus cursos",
  description: 'Activá tu cuenta de Zephyra y empezá a aprender.',
};

export default function LearnerSignupPage() {
  return (
    <section style={{ padding: '4rem 1rem', maxWidth: '40rem', margin: '0 auto' }}>
      <LearnerSignupForm />
    </section>
  );
}
