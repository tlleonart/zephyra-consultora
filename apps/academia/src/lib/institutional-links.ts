import { requireOrigin } from '@zephyra/utils';

/**
 * institutional-links — the links from academia OUT to the institutional site.
 *
 * WHY THIS FILE EXISTS. The split copied the public Navbar and Footer into this
 * app verbatim (boundaries v1.1 §3.1 keeps routes byte-identical), and both
 * carried RELATIVE hrefs to routes that www owns and academia does not:
 *
 *   /            /#servicios   /#equipo
 *   /proyectos   /blog         /contacto
 *
 * Post-split every one of those 404s on this host. Verified on the deployed
 * staging build: the six navbar links, the five footer links and both logo
 * lockups were dead, which is every navigational affordance on the page that is
 * not a course card. Next's prefetch also fired an RSC request per link, so each
 * one produced a console 404 on first paint.
 *
 * WHAT THIS IS AND IS NOT. This is a FAITHFUL EXTRACTION, not a redesign: same
 * labels, same order, same destinations, now addressed absolutely so they reach
 * the app that actually serves them. It decides nothing about what academia's
 * navigation SHOULD say — that is an information-architecture question, it is
 * reserved, and two items in particular are worth a ruling rather than
 * inheritance:
 *
 *   - "Inicio" and both logo lockups point at the INSTITUTIONAL home. A learner
 *     mid-course who clicks the Academia logo therefore leaves the product. That
 *     is what the pre-split markup did (the footer reads "Una iniciativa de
 *     Zephyra"), so it is preserved here, but /cursos is the defensible
 *     alternative and this file is the one place to change it.
 *   - "Servicios" and "Equipo" are ANCHORS into www's home. They only resolve if
 *     those section ids still exist there; nothing in this app can assert that.
 *
 * WHY next/link IS STILL USED at the call sites: given an absolute external
 * href, Next renders a plain anchor and skips both client-side routing and
 * prefetch. That is the desired behaviour and it is what removes the per-link
 * RSC 404s as a side effect.
 *
 * WHY IT THROWS when NEXT_PUBLIC_WWW_URL is unset, instead of falling back to a
 * relative href: a relative href is exactly the bug this file fixes, and it
 * fails INVISIBLY — the page renders, the link looks fine, and it 404s only when
 * a real visitor clicks it. requireOrigin names the missing variable at build
 * time instead (same reasoning as M4/T-be-010). `next build` failing on a
 * misconfigured Vercel project is the intended outcome, so the variable is
 * declared in this app's .env.local.example and in the CI build job.
 */
const WWW_ORIGIN = requireOrigin(
  'NEXT_PUBLIC_WWW_URL',
  // Static property access, deliberately. Next inlines NEXT_PUBLIC_* only for
  // static reads; a dynamic process.env[name] lookup resolves to undefined in
  // the browser bundle (see the note above requireOrigin in
  // packages/utils/src/app-origin.ts).
  process.env.NEXT_PUBLIC_WWW_URL
);

/**
 * Absolute URL for a path served by the institutional site.
 *
 * WWW_ORIGIN carries no trailing slash (normalizeOrigin strips it), so `path`
 * must start with one. `institutionalHref('/')` yields `https://host/`.
 */
export const institutionalHref = (path: string): string => {
  if (!path.startsWith('/')) {
    throw new Error(
      `institutionalHref expects a rooted path starting with "/" (got "${path}")`
    );
  }
  return `${WWW_ORIGIN}${path}`;
};

/** The institutional home. Used by "Inicio" and by both logo lockups. */
export const INSTITUTIONAL_HOME = institutionalHref('/');

/**
 * Navbar link set. Order and labels are the pre-split ones — do not reorder or
 * rename here to "improve" the menu; that is the reserved IA decision.
 */
export const INSTITUTIONAL_NAV_LINKS = [
  { href: INSTITUTIONAL_HOME, label: 'Inicio' },
  { href: institutionalHref('/#servicios'), label: 'Servicios' },
  { href: institutionalHref('/#equipo'), label: 'Equipo' },
  { href: institutionalHref('/proyectos'), label: 'Proyectos' },
  { href: institutionalHref('/blog'), label: 'Perspectivas' },
  { href: institutionalHref('/contacto'), label: 'Contacto' },
] as const;

/**
 * Footer quick-link set. Deliberately NOT the same list as the navbar: the
 * pre-split footer omitted "Equipo". Preserved rather than harmonised.
 */
export const INSTITUTIONAL_FOOTER_LINKS = [
  { href: INSTITUTIONAL_HOME, label: 'Inicio' },
  { href: institutionalHref('/#servicios'), label: 'Servicios' },
  { href: institutionalHref('/proyectos'), label: 'Proyectos' },
  { href: institutionalHref('/blog'), label: 'Perspectivas' },
  { href: institutionalHref('/contacto'), label: 'Contacto' },
] as const;
