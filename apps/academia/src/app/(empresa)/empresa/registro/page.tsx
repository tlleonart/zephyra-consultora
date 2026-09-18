import { OrgSignupForm } from '@/features/org-signup/components/OrgSignupForm';
import { OrgAccountSwitch } from '@/features/org-landing/components/OrgAccountSwitch';
import { getLearnerSession } from '@/features/auth-learner/lib/session';
import { toPublicLearnerSession } from '@/features/auth-learner/lib/public-session';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Cuenta de empresa — Zephyra',
  description:
    'Creá la cuenta de tu organización y comprá cursos para tu equipo con precios por volumen.',
};

export default async function OrgSignupPage() {
  const session = toPublicLearnerSession(await getLearnerSession());
  // UAT2. Con una cuenta personal abierta, el "Iniciá sesión" del formulario no
  // lleva a ningún ingreso (ver OrgAccountSwitch). Va afuera del formulario y
  // no adentro: un <form> no puede anidar otro.
  const personalSession = session && session.type !== 'org_admin' ? session : null;

  return (
    <section style={{ padding: '2rem 0', maxWidth: '34rem', margin: '0 auto' }}>
      <OrgSignupForm session={session} />
      {personalSession ? (
        <OrgAccountSwitch email={personalSession.email} />
      ) : null}
    </section>
  );
}
