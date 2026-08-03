'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import styles from './DashboardLayout.module.css';

export interface DashboardLayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
  header: ReactNode;
}

const SIDEBAR_ID = 'dashboard-sidebar';

/**
 * P-8. Below 1024px the CSS already slid the sidebar off-canvas and defined a
 * `.sidebar.open` escape hatch — but nothing in the tree ever set `open`, and no
 * control existed to set it. At 375px the backoffice was therefore unnavigable:
 * twelve destinations for a superadmin (eleven for an admin — Usuarios is
 * superadmin-only), zero of them reachable. This adds the missing control and nothing
 * else; the navigation itself is untouched.
 *
 * Three deliberate choices:
 *  - The toggle's affordance and focus indicator are a BORDER and an OUTLINE.
 *    Under `forced-colors: active` the UA remaps border-color per state but drops
 *    box-shadow entirely (measured in T-a11y-002), so a shadow-based control
 *    would vanish for exactly the users who need it most.
 *  - Closed, the off-canvas sidebar is `visibility: hidden`, so its links leave
 *    the tab order instead of sending a keyboard user off-screen.
 *  - Escape closes and returns focus to the toggle; a route change closes it, so
 *    following a link does not leave the panel covering the page it opened.
 */
export const DashboardLayout = ({ children, sidebar, header }: DashboardLayoutProps) => {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // Navigating is the success case for this control: close behind the user.
  useEffect(() => {
    setIsNavOpen(false);
  }, [pathname]);

  /**
   * The pathname effect alone is NOT enough, and this was measured rather than
   * reasoned: tapping the nav entry for the route you are already on (Dashboard
   * from /admin) does not change the pathname, so the effect never re-ran and the
   * panel stayed open with its scrim over the page — and because the open panel
   * covers the toggle's own hit area, the control could not be used to recover.
   * Closing on the link activation itself covers both the same-route tap and the
   * cross-route one; the effect is kept for navigations that start elsewhere
   * (back/forward, redirects).
   */
  const handleSidebarActivate = (event: React.MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('a')) setIsNavOpen(false);
  };

  useEffect(() => {
    if (!isNavOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsNavOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isNavOpen]);

  return (
    <div className={styles.container}>
      {/* Two structural decisions, both measured rather than reasoned.
          (1) NOT inside <header>: `.header` is position:sticky with z-index 10,
              which makes it a stacking context, so a z-index on a child is
              resolved INSIDE it and lost against the scrim in the parent context
              — the scrim then intercepted every click on the open state's close
              control. As a fixed sibling of the scrim, the two z-indices compare
              directly. It is display:none above the breakpoint anyway, so it was
              never really part of the desktop header.
          (2) BEFORE the panel in DOM order, which is what puts the twelve nav
              items next in the forward tab sequence after the control that
              reveals them. The alternative was a JS focus move into the panel on
              open; that is not in this file because it could not be demonstrated
              at runtime (the focus call did not take, repeatedly, even deferred a
              frame), and untestable focus management is worse than none. Ordering
              the DOM correctly needs no JS and the tab walk proves it. */}
      <button
        ref={toggleRef}
        type="button"
        className={styles.navToggle}
        aria-expanded={isNavOpen}
        aria-controls={SIDEBAR_ID}
        aria-label={isNavOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
        onClick={() => setIsNavOpen((open) => !open)}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
          focusable="false"
        >
          {isNavOpen ? (
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          ) : (
            <>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </button>

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: not a control — a
          supplementary close on the links' own activation, which fires for
          keyboard Enter as well as for a tap. */}
      <aside
        id={SIDEBAR_ID}
        className={isNavOpen ? `${styles.sidebar} ${styles.open}` : styles.sidebar}
        onClick={handleSidebarActivate}
      >
        {sidebar}
      </aside>

      {isNavOpen && (
        // Pointer-only dismiss surface, and deliberately NOT a tab stop or an AT
        // node: it would otherwise be a third, unlabelled way to do what the
        // toggle and Escape already do, sitting in the middle of the panel's own
        // tab sequence.
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          className={styles.backdrop}
          onClick={() => setIsNavOpen(false)}
        />
      )}

      <div className={styles.main}>
        <header className={styles.header}>{header}</header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
};
