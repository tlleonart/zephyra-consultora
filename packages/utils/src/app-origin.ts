/**
 * appOrigin — resolves an absolute app origin from the environment, or throws.
 *
 * WHY (domain-boundaries v1.1 §5, M4). The three apps no longer share one
 * origin:
 *
 *   www        apex zephyraconsultora.com          institutional, no auth
 *   backoffice backoffice.zephyraconsultora.com    staff only
 *   academia   academia.zephyraconsultora.com      learners + org admins
 *
 * Every generated URL — a password-reset link, a magic link, a seat invite, an
 * SEO canonical, a cross-host "open the player" button — must name the app that
 * owns the flow. Before M4 several of these fell back to the literal
 * "https://zephyraconsultora.com" and the rest interpolated `undefined`.
 *
 * WHY IT THROWS. A silent fallback to the apex is strictly worse than no value:
 * the planned 301 map (boundaries §3.1) covers only `/cursos/:path*` and
 * `/admin/:path*`, so an apex link to `/empresa/*` or `/reset-password` is a
 * hard 404 — and even the covered prefixes have no redirect until M6. A missing
 * variable is a deploy-configuration error; throwing names the variable at the
 * first moment it is read (build or first render) instead of shipping a link
 * that resolves to the wrong app.
 *
 * Convention, one variable per role per app:
 *   NEXT_PUBLIC_APP_URL       this app's OWN origin (links + SEO canonicals)
 *   NEXT_PUBLIC_ACADEMIA_URL  academia's origin, for cross-host links out of
 *                             another app (backoffice → player)
 *
 * `NEXT_PUBLIC_SITE_URL` is retired: it meant the same thing as
 * NEXT_PUBLIC_APP_URL, and two variables holding one value drift.
 */

/**
 * Trim trailing slashes and assert a bare absolute origin (scheme + host
 * [+ port], no path). A path component would double up against the paths
 * callers append.
 */
const normalizeOrigin = (raw: string, varName: string): string => {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^/?#\s]+$/.test(trimmed)) {
    throw new Error(
      `${varName} must be an absolute origin with no path, e.g. ` +
        `"https://academia.zephyraconsultora.com" (got "${trimmed}")`
    );
  }
  return trimmed;
};

/**
 * Resolve `varName` from the value read out of `process.env`, or throw.
 *
 * The value is passed in rather than looked up by name on purpose: Next.js
 * inlines `NEXT_PUBLIC_*` reads at build time only for STATIC property accesses
 * (`process.env.NEXT_PUBLIC_APP_URL`). A dynamic `process.env[varName]` lookup
 * is NOT inlined and resolves to undefined in the browser bundle — so this
 * helper must never do the lookup itself.
 *
 * @param varName name of the variable, for the error message
 * @param raw     the value, read at the call site as a static property access
 * @throws Error naming the variable when unset, blank, or not an origin
 */
export const requireOrigin = (
  varName: string,
  raw: string | undefined
): string => {
  if (raw === undefined || raw.trim() === '') {
    throw new Error(
      `Missing ${varName}. It must be the absolute origin of the app that ` +
        `serves this flow (domain-boundaries v1.1 §5) — e.g. ` +
        `"https://academia.zephyraconsultora.com". Set it in the app's ` +
        `.env.local and in its Vercel project. Refusing to fall back to the ` +
        `apex: post-split the apex serves only the institutional site, and the ` +
        `301 map covers neither /empresa/* nor /reset-password, so a fallback ` +
        `would silently produce a 404 for real users.`
    );
  }
  return normalizeOrigin(raw, varName);
};
