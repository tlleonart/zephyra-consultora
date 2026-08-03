/**
 * THE SINGLE EDIT POINT FOR EVERY UNRATIFIED BRAND DECISION.
 *
 * Zephyra has not ratified the lockup architecture, the descriptor treatment or
 * the icon mark. The standing instruction is not "document that these may
 * change" — it is that they must be CHEAP TO REVERSE. So no screen references a
 * brand asset path or hardcodes the product name: they all render <Brandmark />,
 * which reads this file. Swapping any decision below is a one-value edit here.
 *
 *   D-1  the lockup architecture .............. BRAND_LOCKUP (asset paths)
 *   D-2  the descriptor treatment ............. DESCRIPTOR_TREATMENT (this switch)
 *   D-3  the icon mark ........................ not here: pure file swap, see below
 *
 * D-3 needs no code at all. Next.js App Router picks the icon up by FILE
 * CONVENTION from src/app/{favicon.ico,icon.png,apple-icon.png} plus
 * public/icons/* for the manifest. Choosing the redrawn flower over the Z
 * monogram means overwriting those files and nothing else — no import, no
 * component, no markup. (Do NOT hand-write <link rel="icon"> tags: with the file
 * convention in place that emits duplicates.)
 *
 * Naming is enforced here too, per the brand guide and the domain boundaries:
 * "Academia Zephyra". Never "Zephyra Academy", never "LMS" (internal only),
 * never "campus" — CAMPUS is the upstream content provider, a reserved word that
 * is never user-facing.
 */

/** The product name, user-facing. Every <title>, OG tag and alt text uses this. */
export const BRAND_NAME = 'Academia Zephyra';

/** Short form, for the PWA name and tight UI. */
export const BRAND_NAME_SHORT = 'Academia';

export const BRAND_DESCRIPTION =
  'Formación en diversidad, equidad, inclusión y sostenibilidad.';

/** Back-link wording to the institutional site. Never an agency credit. */
export const BRAND_ORIGIN_LINE = 'Una iniciativa de Zephyra';

export interface BrandAsset {
  /** For dark/green surfaces: the navbar's translucent-dark header, the footer band. */
  onDark: string;
  /** For paper, sand and card surfaces. */
  onLight: string;
  /** Intrinsic pixel size. 947x207 is the RESOLUTION CEILING — the only logo in
   *  the repo is a raster and no vector source exists. Requested from Zephyra. */
  width: number;
  height: number;
}

/**
 * D-1, option A (delivered, recommended): the real logo's own architecture, with
 * the descriptor slot reset to "ACADEMIA" using the logo's own letterforms. Zero
 * invention.
 *
 * D-1, option B (the mockup's composition): an invented circle-and-leaf symbol
 * plus a Playfair wordmark. That symbol is not Zephyra's mark, and the
 * composition reintroduces exactly the typographic wordmark the brand guide
 * retires. Choosing it means REPLACING these two files — it is not an
 * adjustment, and it needs two fresh brand approvals.
 *
 * Either way: the swap is these paths, and only these paths.
 */
export const BRAND_LOCKUP: BrandAsset = {
  onDark: '/images/brand/lockup-academia-sand-on-transparent.png',
  onLight: '/images/brand/lockup-academia-green-on-transparent.png',
  width: 947,
  height: 207,
};

/**
 * The institutional mark WITHOUT a baked descriptor, for the live-text treatment.
 * `onLight` is new: a green-on-transparent variant of the institutional logo, an
 * asset gap that predates this task.
 */
export const BRAND_MARK: BrandAsset = {
  onDark: '/images/zephyra-logo.png',
  onLight: '/images/brand/zephyra-logo-green-on-transparent.png',
  width: 947,
  height: 207,
};

/**
 * D-2 — how "Academia" is said next to the mark.
 *
 * 'live-text'    the mark plus "Academia" as real text (RECOMMENDED, default).
 *                A baked-in descriptor renders about 4.5px tall at a 40px logo
 *                height and is unreadable — already true of the institutional
 *                site today. Live text stays legible, selectable and accessible.
 * 'baked-lockup' the flattened lockup image, descriptor included. Correct where
 *                live text is unavailable or unreliable: email headers,
 *                certificates, OG/social images.
 *
 * Flip this one value to change every surface at once.
 */
export const DESCRIPTOR_TREATMENT: 'live-text' | 'baked-lockup' = 'live-text';

/**
 * ── EMAIL CHROME (guide §8.4: "the lockup and green band header") ─────────────
 *
 * Email is the one context that cannot read a custom property, cannot use a
 * CSS Module, and cannot resolve a relative image path — so it needs literals
 * and absolute URLs. Both are produced HERE rather than in the templates, for
 * the same reason nothing else names an asset path: D-1 has to stay a one-value
 * edit. Change BRAND_LOCKUP above and every email header follows.
 *
 * `origin` is derived by the caller from the action URL it was already given
 * (`new URL(magicLinkUrl).origin`). That is deliberate: a literal
 * `zephyraconsultora.com` in a template is the exact regression apps/www's suite
 * fails the build over, and the caller's own link is the only host that is
 * guaranteed correct per environment (dev, preview, prod).
 */
export const EMAIL_PALETTE = {
  /** brand-main. The band, the CTA fill. */
  green: '#1E3C2E',
  /** brand-dark. The band's gradient end / CTA hover (emails: the darker rule). */
  greenDark: '#152B21',
  /** paper. The page behind the card. */
  paper: '#EFEAE0',
  /** surface-card. The content card, which sits above paper. */
  card: '#FCFAF6',
  /** sand. Dividers and the on-green descriptor. */
  sand: '#E5DFD5',
  /** text / text-secondary, warm neutrals. 16.69:1 and 9.13:1 on card. */
  text: '#1A1A1A',
  textSecondary: '#4A453B',
  /** border, warm. */
  border: '#D8CFBF',
} as const;

/**
 * The flattened lockup for a green band, as an absolute URL.
 *
 * `baked` is forced here regardless of DESCRIPTOR_TREATMENT: live text is the
 * right call on the web (D-2), but an email cannot ship the brand's webfont, so
 * the descriptor has to be part of the raster. This is exactly the context the
 * baked variants were carved for.
 */
export function brandEmailLockup(origin: string): {
  src: string;
  alt: string;
  width: number;
  height: number;
} {
  const height = 34;
  return {
    src: `${trimOrigin(origin)}${BRAND_LOCKUP.onDark}`,
    alt: BRAND_NAME,
    width: Math.round((BRAND_LOCKUP.width / BRAND_LOCKUP.height) * height),
    height,
  };
}

/**
 * The origin of an absolute URL the template was handed, or '' if it cannot be
 * parsed. Returning '' degrades to a relative src — the image silently fails to
 * load and the alt text carries the brand, which is strictly better than
 * throwing inside a transactional email or hardcoding a host.
 */
export function emailOriginFrom(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

function trimOrigin(origin: string): string {
  return origin.replace(/\/+$/, '');
}
