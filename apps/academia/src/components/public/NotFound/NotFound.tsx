import Link from 'next/link';
import { INSTITUTIONAL_HOME } from '@/lib/institutional-links';
import styles from './NotFound.module.css';

/**
 * NotFound — the branded 404 panel.
 *
 * WHY IT IS A COMPONENT AND NOT JUST A ROUTE FILE. It is rendered from TWO
 * not-found boundaries, and the app needs both:
 *
 *   app/(public)/not-found.tsx  catches 404s raised INSIDE the (public) segment,
 *                               and inherits that group's layout, so it comes
 *                               with the Navbar and Footer.
 *   app/not-found.tsx           the app-wide fallback for a path that matches no
 *                               route at all — /proyectos, /blog, /contacto, /.
 *
 * The second one was MISSING, and the consequence was visible in production
 * shape on the deployed staging build: those paths fell through to Next's
 * built-in 404, which renders "This page could not be found." — in English, on a
 * document whose <html lang> is "es", with no Zephyra branding and NO LINK OUT.
 *
 * That gap predates the split; it was merely hidden while one host served every
 * route. It surfaced here because the navbar's institutional links used to be
 * relative and therefore landed on this app's own 404 — and that 404's "volver al
 * inicio" button was itself relative, so the escape hatch from a 404 was another
 * 404. Both halves are fixed: the links now name the host that serves them (see
 * @/lib/institutional-links) and the fallback boundary now exists.
 *
 * The root boundary renders this panel WITHOUT the Navbar and Footer, because
 * those are mounted by (public)/layout.tsx and duplicating that wrapper would
 * create a second place in this app that mounts them. The panel carries the
 * brand and the way out on its own, which is what recovery requires.
 *
 * NOTE for apps/www and apps/backoffice: neither has a root not-found either, so
 * both still serve the English default for an unmatched path. Not changed from
 * here — that is their own scope and a separate decision.
 */
export const NotFound = () => (
  <div className={styles.container}>
    <div className={styles.content}>
      <span className={styles.code}>404</span>
      <h1 className={styles.title}>Pagina no encontrada</h1>
      <p className={styles.message}>
        Lo sentimos, la pagina que buscas no existe o ha sido movida.
      </p>
      {/* Absolute, via institutional-links: a relative "/" is a 404 on THIS
          host, which would make the recovery link a dead end. */}
      <Link href={INSTITUTIONAL_HOME} className={styles.button}>
        Volver al inicio
      </Link>
    </div>
  </div>
);
