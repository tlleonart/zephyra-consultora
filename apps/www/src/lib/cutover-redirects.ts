import { requireOrigin } from '@zephyra/utils';

/**
 * cutover-redirects — the 301 map from the apex to the two apps that moved off it.
 *
 * WHY THIS EXISTS. Before the split one host served every route. After it, the
 * apex serves ONLY the institutional site, so every URL that used to live at
 * zephyraconsultora.com and now belongs to academia or backoffice has to be
 * redirected or it becomes a hard 404 on cutover day — including links already
 * in the wild, in inboxes, and in search indexes.
 *
 * FOUR RULE GROUPS, NOT TWO. domain-boundaries v1.1 §3.1 specified two
 * (`/cursos/:path*` and `/admin/:path*`). That covers less than the route tree
 * actually exposes, measured against what is live on origin/main today:
 *
 *   /login /forgot-password /reset-password   ADDED. These are NOT under /admin,
 *       so `/admin/:path*` never matched them. `/login` is the URL Zephyra's own
 *       staff use to reach the CMS right now — without this group, the people who
 *       publish the site lose access on cutover day with no error that explains
 *       where it went. `/reset-password` matters twice over: any reset email
 *       already sent carries an apex link, and Next preserves the query string
 *       across a redirect, so the ?token survives the hop.
 *
 *   /empresa/:path*                            ADDED. §3.1 justified keeping the
 *       /empresa prefix partly because seat-invite and org-signup links "already
 *       in the wild keep resolving" — which is only true if a redirect exists.
 *       It also carries the MercadoPago RETURN surfaces for B2B pack purchases
 *       (/empresa/compra/{exito,error,pendiente}). A buyer landing on a 404
 *       AFTER paying is the worst version of this failure. T-be-010 made that
 *       specific case impossible by removing the apex fallbacks, but that is a
 *       safety net, not a substitute for the redirect.
 *
 * Ruled rather than escalated because it only ADDS redirects: it changes no
 * ownership decision and contradicts nothing in §2 or §3. The amendment request
 * is with the spec owner, along with the open question of whether a fifth group
 * exists — a legacy public URL predating this repo would not show up in a route
 * tree, and only Search Console can answer that.
 *
 * WHY PERMANENT. These moves are not provisional; the boundary model is the
 * deliverable. The tradeoff is real and worth stating: browsers and
 * intermediaries CACHE permanent redirects aggressively and for a long time, so a
 * wrong destination shipped here is expensive to walk back — a visitor who once
 * got the bad redirect may keep getting it from their own cache even after a fix.
 * That is precisely why these rules are exercised on staging before the cutover
 * rather than first observed in production.
 *
 * WHY `statusCode: 301` AND NOT `permanent: true`. They are not the same thing,
 * and the difference is invisible in review: Next's `permanent: true` emits
 * **308**, not 301. Verified by reading .next/routes-manifest.json rather than
 * assumed. 308 is a correct permanent redirect and Google treats it like 301, but
 * two reasons make the literal 301 the right choice here:
 *
 *   - The spec and the amendment request both say "the 301 map". Silently
 *     shipping 308 under that name would make the document and the build
 *     disagree about something a reader would reasonably check.
 *   - 308's distinguishing feature is preserving the request METHOD and body.
 *     Every path in this map is a GET navigation — a staff member clicking
 *     /login, a learner opening an invite, a buyer returning from MercadoPago —
 *     so that guarantee buys nothing, while 301 is understood by every client and
 *     crawler ever written (308 was only standardised in RFC 7538, 2015).
 *
 * Nothing POSTs to these apex paths: the login form lives on backoffice and posts
 * to its own origin, and the MercadoPago webhook addresses Convex directly, not
 * the apex.
 *
 * WHY next.config redirects AND NOT MIDDLEWARE. These are static, path-only
 * rules with no request-state dependency. Vercel serves them from the routing
 * layer, so they cost no function invocation and cannot be broken by a
 * middleware matcher bug — which is not hypothetical: apps/backoffice shipped an
 * inert matcher (one backslash instead of two) that silently disabled its own
 * auth redirect.
 */

/**
 * A Next.js redirect entry.
 *
 * `statusCode: 301` rather than `permanent: true` — those are different wire
 * responses (permanent:true emits 308). See the note above.
 */
export interface CutoverRedirect {
  source: string;
  destination: string;
  statusCode: 301;
}

/** The literal status every rule in this map emits. */
export const CUTOVER_STATUS = 301 as const;

/** Path prefixes academia owns, redirected path-preserving. */
const ACADEMIA_PREFIXES = ['/cursos', '/empresa'] as const;

/** Path prefixes backoffice owns, redirected path-preserving. */
const BACKOFFICE_PREFIXES = ['/admin'] as const;

/**
 * Exact auth paths backoffice owns. These are NOT prefixes: the apex must not
 * blanket-redirect anything that merely starts with these strings, and each one
 * is a single page.
 */
const BACKOFFICE_EXACT = [
  '/login',
  '/forgot-password',
  '/reset-password',
] as const;

/**
 * Build the redirect list.
 *
 * Origins are passed IN rather than read from process.env here so the rules can
 * be asserted in a unit test without mutating the environment, and so the loop
 * guard below has something to compare against.
 *
 * @throws when either destination origin is missing (via requireOrigin), or when
 *         a destination equals the apex's own origin.
 */
export const buildCutoverRedirects = (raw: {
  academia: string | undefined;
  backoffice: string | undefined;
  /** This app's own origin, when known, purely for the loop guard. */
  self?: string | undefined;
}): CutoverRedirect[] => {
  const academia = requireOrigin('NEXT_PUBLIC_ACADEMIA_URL', raw.academia);
  const backoffice = requireOrigin('NEXT_PUBLIC_BACKOFFICE_URL', raw.backoffice);

  /**
   * LOOP GUARD. If a destination resolves to this app's own origin, the redirect
   * sends the request straight back to the rule that produced it and the browser
   * gives up with ERR_TOO_MANY_REDIRECTS. That is a plausible misconfiguration —
   * three Vercel projects, three sets of variables, similar-looking hostnames —
   * and it would take down /cursos and /admin entirely. Refuse to build instead.
   */
  const self = raw.self?.trim() ? requireOrigin('NEXT_PUBLIC_APP_URL', raw.self) : undefined;
  if (self) {
    for (const [name, value] of [
      ['NEXT_PUBLIC_ACADEMIA_URL', academia],
      ['NEXT_PUBLIC_BACKOFFICE_URL', backoffice],
    ] as const) {
      if (value === self) {
        throw new Error(
          `${name} (${value}) is the same origin as this app. The apex would ` +
            `redirect these paths to itself, which loops until the browser ` +
            `aborts. Each app needs its OWN origin in its OWN Vercel project.`
        );
      }
    }
  }

  const redirects: CutoverRedirect[] = [];

  /**
   * Two rules per prefix: the bare prefix EXACTLY, and everything under it.
   *
   * WHY NOT ONE RULE WITH `:path*`. That was the first shape, and it worked — but
   * `:path*` matches zero segments, and with zero segments the destination
   * `/cursos/:path*` interpolates to `/cursos/` WITH A TRAILING SLASH. The
   * destination app runs Next's default trailingSlash:false, so it answers that
   * with its own 308 back to `/cursos`. Measured on staging:
   *
   *     apex/cursos  --301->  academia/cursos/  --308->  academia/cursos  --200
   *
   * Three hops for the single most likely entry point — `/cursos` bare is exactly
   * what someone types or has bookmarked. It also means the chain mixes a 301
   * with a 308 and caches an intermediate URL nobody intended to publish. `:path+`
   * requires at least one segment, so the two cases are disjoint and neither
   * depends on rule ordering.
   */
  const prefixRules = (prefix: string, origin: string): CutoverRedirect[] => [
    { source: prefix, destination: `${origin}${prefix}`, statusCode: CUTOVER_STATUS },
    {
      source: `${prefix}/:path+`,
      destination: `${origin}${prefix}/:path+`,
      statusCode: CUTOVER_STATUS,
    },
  ];

  for (const prefix of ACADEMIA_PREFIXES) redirects.push(...prefixRules(prefix, academia));
  for (const prefix of BACKOFFICE_PREFIXES) redirects.push(...prefixRules(prefix, backoffice));
  for (const exact of BACKOFFICE_EXACT) {
    redirects.push({
      source: exact,
      destination: `${backoffice}${exact}`,
      statusCode: CUTOVER_STATUS,
    });
  }

  return redirects;
};

/** The path prefixes and exact paths this map covers, for tests and docs. */
export const COVERED = {
  academiaPrefixes: ACADEMIA_PREFIXES,
  backofficePrefixes: BACKOFFICE_PREFIXES,
  backofficeExact: BACKOFFICE_EXACT,
} as const;
