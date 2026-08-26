import Link from 'next/link';
import styles from './NotFound.module.css';

/**
 * NotFound — the branded 404 panel, shared by both boundaries this app defines.
 *
 * WHY TWO BOUNDARIES NEED IT.
 *
 *   app/(public)/not-found.tsx  catches a 404 raised INSIDE the (public) segment,
 *                               and inherits that group's layout, so it renders
 *                               WITH the Navbar and Footer.
 *   app/not-found.tsx           the app-wide fallback for a path that matches no
 *                               route at all. This one was MISSING — any URL that
 *                               does not fall inside the (public) segment (a typo,
 *                               a stale bookmark, a bad crawler link) fell through
 *                               to Next's built-in 404: "This page could not be
 *                               found.", in English, on a document whose <html
 *                               lang> is "es", unbranded, with no link out.
 *
 * Same defect class academia fixed at eba96c4 (see its
 * components/public/NotFound/NotFound.tsx). www's version does not need an
 * institutional-links indirection: this app IS the institutional site, so "/"
 * is a same-origin, always-valid way home — unlike academia, which has to name
 * a foreign host.
 *
 * The root boundary renders this panel WITHOUT the Navbar and Footer, because
 * those are mounted by (public)/layout.tsx and duplicating that wrapper here
 * would create a second place in this app that mounts them.
 */
export const NotFound = () => (
  <div className={styles.container}>
    <div className={styles.content}>
      <span className={styles.code}>404</span>
      <h1 className={styles.title}>Pagina no encontrada</h1>
      <p className={styles.message}>
        Lo sentimos, la pagina que buscas no existe o ha sido movida.
      </p>
      <Link href="/" className={styles.button}>
        Volver al inicio
      </Link>
    </div>
  </div>
);
