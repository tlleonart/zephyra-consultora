import Link from 'next/link';
import styles from './NotFound.module.css';

/**
 * NotFound — the branded 404 panel for the staff console.
 *
 * WHY THIS EXISTS. apps/backoffice had no `app/not-found.tsx`, so a made-up URL
 * (or the bare root `/`, before this same change gave it a page) fell through to
 * Next's built-in 404 — "This page could not be found.", in English, on a
 * document declaring lang="es", carrying no Zephyra branding and no way back.
 * See app/not-found.tsx for the routing side of the fix.
 *
 * The way out is a RELATIVE `/`. That is deliberate and differs from
 * apps/academia's equivalent panel, which points at an absolute institutional
 * URL: `/` is a route THIS app owns (app/page.tsx resolves it by session), so a
 * relative link cannot be a cross-host 404 the way it would from academia's
 * public routes. Do not swap this for an absolute institutional link — that
 * would send a staff member to the public marketing site instead of back into
 * the console.
 */
export const NotFound = () => (
  <div className={styles.container}>
    <div className={styles.content}>
      <span className={styles.code}>404</span>
      <h1 className={styles.title}>Página no encontrada</h1>
      <p className={styles.message}>
        La página que buscás no existe o fue movida.
      </p>
      <Link href="/" className={styles.button}>
        Volver al inicio
      </Link>
    </div>
  </div>
);
