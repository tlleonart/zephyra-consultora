import Link from 'next/link';
import { Brandmark } from '@/components/public/Brandmark';
import { getLearnerSession } from '@/features/auth-learner/lib/session';
import { OrgSignoutButton } from '@/features/org-signup/components/OrgSignoutButton';
import styles from './layout.module.css';

/**
 * E1 — empresa route group shell. Mirrors the brand styling of the admin
 * dashboard but is gated on the LEARNER session (cookie session-learner), not
 * the admin session — the org owner is a learner-session identity of
 * type:"org_admin". The shell shows a "Catálogo" / "Mi empresa" nav for a
 * signed-in owner and a sign-out control; the sign-up pages render without a
 * session (the topbar nav simply omits the owner-only links).
 *
 * Per-page auth: the console page (/empresa) enforces the org-owner gate; the
 * registro pages are intentionally reachable without a session.
 */
export default async function EmpresaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getLearnerSession();
  const isOwner = session?.type === 'org_admin';

  return (
    <div className={styles.layout}>
      <header className={styles.topbar}>
        {/* The lockup, not a hand-typed wordmark. The old markup spelled
            "Zephyra" as live text in Playfair — precisely the typographic
            wordmark the brand guide retires (§4) — and it was a second place
            the brand was expressed. <Brandmark/> reads @/lib/brand, so D-1 and
            D-2 stay one-value edits here too. */}
        <Link
          href={isOwner ? '/empresa' : '/empresa/registro'}
          className={styles.brand}
        >
          <Brandmark tone="onDark" height={30} priority />
          <span className={styles.brandSuffix}>Empresas</span>
        </Link>
        {isOwner ? (
          <nav className={styles.nav} aria-label="Navegación de empresa">
            <Link href="/empresa" className={styles.navLink}>
              Mi empresa
            </Link>
            <Link href="/empresa/cursos" className={styles.navLink}>
              Catálogo
            </Link>
            <OrgSignoutButton />
          </nav>
        ) : null}
      </header>
      <main className={styles.main}>
        <div className={styles.inner}>{children}</div>
      </main>
    </div>
  );
}
