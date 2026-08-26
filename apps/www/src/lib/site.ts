import { requireOrigin } from '@zephyra/utils';

/**
 * SITE-WIDE constants for document + Open Graph metadata.
 *
 * WHY THIS EXISTS. `grep openGraph apps/www/src` returned zero files: the root
 * layout declared only `title` + `description`, and no page declared any
 * `openGraph` fields at all — so sharing a link to any www page (the home page,
 * a blog post) produced a preview with a title but NO image, on every platform
 * that renders link previews. Two testers hit this independently.
 *
 * Centralised here — mirroring apps/academia's @/lib/brand — so SITE_URL is
 * resolved exactly once (module scope: a missing NEXT_PUBLIC_APP_URL then fails
 * `next build` loudly, which is the cheapest place to catch it) and the site
 * name/description/default image cannot drift between the layout, the home
 * page and the blog.
 *
 * Every image URL below is ABSOLUTE. A relative URL in openGraph.images is not
 * a bug any suite here would catch by rendering — it simply fails silently in
 * every crawler that does not resolve it against the document, which is most
 * of them. See DEFAULT_OG_IMAGE.
 */

/** The site name, user-facing. Every <title> default and OG tag uses this. */
export const SITE_NAME = 'Zephyra Consultora';

export const SITE_DESCRIPTION = 'Consultora de sostenibilidad e impacto social';

/**
 * This app's own origin. www is served from the apex (zephyraconsultora.com);
 * see domain-boundaries v1.1 §5 and @zephyra/utils' requireOrigin for why a
 * missing value throws instead of silently falling back.
 */
export const SITE_URL = requireOrigin(
  'NEXT_PUBLIC_APP_URL',
  process.env.NEXT_PUBLIC_APP_URL
);

/**
 * The fallback OG image for any page that has no image of its own (the home
 * page) or whose own image is unavailable (a blog post with no cover). Already
 * used as the home hero's background — reused here rather than adding a new
 * asset.
 */
export const DEFAULT_OG_IMAGE = `${SITE_URL}/images/hero-background.jpg`;
