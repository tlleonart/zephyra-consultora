import { Suspense } from 'react';
import { OrgCreateContent } from '@/features/org-signup/components/OrgCreateContent';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Creando tu organización — Zephyra',
};

export default function OrgCreatePage() {
  return (
    <section style={{ padding: '2rem 0', maxWidth: '34rem', margin: '0 auto' }}>
      <Suspense fallback={<p>Cargando…</p>}>
        <OrgCreateContent />
      </Suspense>
    </section>
  );
}
