/**
 * publicUrls — resolves the ABSOLUTE origin of the Next.js app that owns a flow,
 * for the URLs this backend mints into emails and payment callbacks.
 *
 * WHY THIS EXISTS (domain-boundaries v1.1 §5, M4).
 * Post-split the platform serves three hosts:
 *
 *   www        apex zephyraconsultora.com          institutional, no auth
 *   backoffice backoffice.zephyraconsultora.com    staff only
 *   academia   academia.zephyraconsultora.com      learners + org admins
 *
 * Every URL this backend generates belongs to ACADEMIA: the buyer-confirmation
 * player link (/cursos/<slug>/player) and the MercadoPago back_urls
 * (/cursos/<slug>/compra/* for B2C, /empresa/compra/* for B2B). None of them are
 * served by the apex.
 *
 * WHY IT THROWS INSTEAD OF DEFAULTING TO THE APEX.
 * Both call sites used to fall back to the literal "https://zephyraconsultora.com".
 * That default is worse than no value at all:
 *
 *   - The planned 301 map (boundaries §3.1, T-fe-016) is TWO prefix-preserving
 *     rules: /cursos/:path* and /admin/:path*. `/empresa/:path*` is NOT in it.
 *     So an apex fallback strands every B2B pack buyer on a hard 404 at
 *     apex/empresa/compra/exito — after MercadoPago has taken the money.
 *   - Even for /cursos/*, the 301s do not exist until M6. Until then an apex
 *     fallback is a 404 for the B2C player link too.
 *   - A missing env var is a deploy-configuration error. Surfacing it as a
 *     thrown error names the variable; surfacing it as a wrong host produces a
 *     support ticket weeks later with no trace back to the cause.
 *
 * Both call sites tolerate the throw (see each for the analysis): the buyer
 * email runs in a scheduled internalAction AFTER the enrollment/payment
 * transaction has committed, so a throw costs the email and logs loudly but
 * cannot roll back an enrollment; the MercadoPago adapter throws in its
 * constructor, BEFORE a preference exists, so no money can be taken against a
 * broken callback.
 *
 * NOTE ON process.env IN CONVEX: these resolve against the DEPLOYMENT's
 * environment (`npx convex env set`), never against any .env.local file.
 */

/** Canonical variable name for academia's origin on the Convex deployment. */
const ACADEMIA_VAR = "ZEPHYRA_ACADEMIA_URL";

/**
 * Deprecated alias, accepted only during the M4→M6 transition.
 *
 * The name predates the split, when there was one "public" host. It is now
 * ambiguous — "public" could mean the apex — which is exactly the class of
 * mistake this module exists to prevent. It is still honoured because the
 * shared dev deployment currently defines ONLY this variable
 * (`npx convex env list` @ 2026-07-31), and dropping it would break the dev
 * money path the moment this lands.
 *
 * M6 action item (T-be-015): set ZEPHYRA_ACADEMIA_URL on both the dev and the
 * prod deployment, then delete ZEPHYRA_PUBLIC_URL and this branch.
 */
const ACADEMIA_VAR_LEGACY = "ZEPHYRA_PUBLIC_URL";

/**
 * Trim a trailing slash and assert the value is a bare absolute origin
 * (scheme + host [+ port], no path). A path component would silently double up
 * against the paths the callers append.
 */
const normalizeOrigin = (raw: string, varName: string): string => {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!/^https?:\/\/[^/?#\s]+$/.test(trimmed)) {
    throw new Error(
      `${varName} must be an absolute origin with no path, e.g. ` +
        `"https://academia.zephyraconsultora.com" (got "${trimmed}")`
    );
  }
  return trimmed;
};

/**
 * Absolute origin of apps/academia. Throws (never guesses) when unset.
 *
 * @throws Error naming the variable to set, listing the paths that would break.
 */
export const academiaBaseUrl = (): string => {
  const explicit = process.env[ACADEMIA_VAR];
  if (explicit && explicit.trim() !== "") {
    return normalizeOrigin(explicit, ACADEMIA_VAR);
  }

  const legacy = process.env[ACADEMIA_VAR_LEGACY];
  if (legacy && legacy.trim() !== "") {
    return normalizeOrigin(legacy, ACADEMIA_VAR_LEGACY);
  }

  throw new Error(
    `Missing ${ACADEMIA_VAR} in the Convex deployment env. It must be the ` +
      `absolute origin of apps/academia (e.g. ` +
      `"https://academia.zephyraconsultora.com"), because every URL this ` +
      `backend generates — the buyer-confirmation player link and the ` +
      `MercadoPago back_urls (/cursos/*/compra/*, /empresa/compra/*) — is ` +
      `served by that app and by no other host. Set it with ` +
      `\`npx convex env set ${ACADEMIA_VAR} <origin>\`. Refusing to fall back ` +
      `to the apex: /empresa/* has no 301 rule, so the fallback would strand ` +
      `paying B2B buyers on a 404 (domain-boundaries v1.1 §5).`
  );
};
