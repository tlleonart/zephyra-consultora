import { ClaimContent } from '@/features/seats/components/ClaimContent';
import styles from './Invitacion.module.css';

// force-dynamic: the claim is a live mutation against the invite token; nothing
// is cached. The page itself only reads the URL params and hands them to the
// client claim flow (which calls the gated claimSeat action).
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Activar mi acceso — Zephyra',
};

/**
 * E4 — seat claim landing (api-contract §C2). The invite email links here with
 * ?token=&cr=&org=&pack=. The (org, seatPack) binding lives in the URL (not the
 * token row) and is re-verified server-side at claim time. We collect/confirm
 * the employee email, then claimSeat burns the token, creates the org_learner +
 * one active enrollment, and the client routes into the SAME player UX as B2C.
 *
 * Replay (already-claimed) → the existing enrollment is returned; over-claim
 * (pack full) → a clear message. Both handled in ClaimContent.
 */
export default async function InvitacionPage({
  searchParams,
}: {
  searchParams: Promise<{
    token?: string;
    cr?: string;
    org?: string;
    pack?: string;
  }>;
}) {
  const { token, cr, org, pack } = await searchParams;

  const valid =
    typeof token === 'string' &&
    token.length > 0 &&
    typeof cr === 'string' &&
    cr.length > 0 &&
    typeof org === 'string' &&
    org.length > 0 &&
    typeof pack === 'string' &&
    pack.length > 0;

  return (
    <main className={styles.wrapper}>
      <section className={styles.card} aria-labelledby="invite-title">
        <p className={styles.eyebrow}>Invitación de equipo</p>
        <h1 id="invite-title" className={styles.title}>
          Activá tu acceso al curso
        </h1>
        {valid ? (
          <ClaimContent
            token={token}
            claimRequestId={cr}
            organizationId={org}
            seatPackId={pack}
          />
        ) : (
          <p className={styles.invalid} role="alert">
            Este link de invitación está incompleto o es inválido. Pedile a tu
            empresa que te reenvíe la invitación.
          </p>
        )}
      </section>
    </main>
  );
}
