import { requireOrigin } from '@zephyra/utils';

/**
 * Links from the STAFF console into the LEARNER app (V28, M4).
 *
 * Backoffice is served from backoffice.zephyraconsultora.com; the SCORM player
 * lives at academia.zephyraconsultora.com/cursos/<slug>/player. Two call sites
 * pushed the RELATIVE path `/cursos/<slug>/player`, which resolves against the
 * CURRENT host — so post-split they 404 on backoffice.*.
 *
 * The framing that made these visible: "leave hardcoded URLs alone" cannot mean
 * "leave relative cross-host links alone". A relative link is not a hardcoded
 * URL, it is a MISSING one, and it is invisible to any grep for a hostname.
 *
 * WHY THIS IS LAZY (resolved per call, not at module scope). A module-scope
 * resolve would fail `next build` when the variable is missing — an attractive
 * early signal — but these are CLIENT components, so the throw would take down
 * the whole admin course list rather than one button, and it would couple the
 * build of the staff console to a variable that only affects two links. Resolving
 * per call keeps the blast radius at the link, and the M6 checklist carries the
 * variable instead.
 */
const academiaOrigin = (): string =>
  requireOrigin(
    'NEXT_PUBLIC_ACADEMIA_URL',
    process.env.NEXT_PUBLIC_ACADEMIA_URL
  );

/**
 * Absolute URL of a course's SCORM player on the academia host.
 *
 * The PATH is unchanged from pre-split (`/cursos/<slug>/player`) — boundaries
 * v1.1 §3.1 D1 keeps the `/cursos` prefix on the academia host; only the origin
 * is now explicit.
 *
 * @param slug course slug, as stored on lmsCourses.slug
 * @throws Error when NEXT_PUBLIC_ACADEMIA_URL is unset — never returns a
 *   relative path, which would silently resolve to this (wrong) host
 */
export const academiaPlayerUrl = (slug: string): string =>
  `${academiaOrigin()}/cursos/${encodeURIComponent(slug)}/player`;
