import { OrgSignupForm } from '@/features/org-signup/components/OrgSignupForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Cuenta de empresa — Zephyra',
  description:
    'Creá la cuenta de tu organización y comprá cursos para tu equipo con precios por volumen.',
};

export default function OrgSignupPage() {
  return (
    <section style={{ padding: '2rem 0', maxWidth: '34rem', margin: '0 auto' }}>
      <OrgSignupForm />
    </section>
  );
}
