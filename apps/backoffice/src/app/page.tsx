import { redirect } from 'next/navigation';
import { getSession } from '@/features/auth/lib/session';

/**
 * Root of the backoffice (C-02). Before this file existed, `/` matched no
 * route in either the (auth) or (dashboard) groups and returned a bare 404 —
 * the staff console's own front door 404ed. This resolves session the same way
 * (dashboard)/admin/page.tsx does and sends the visitor to the right place
 * instead of rendering anything itself.
 */
export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const session = await getSession();
  redirect(session ? '/admin' : '/login');
}
