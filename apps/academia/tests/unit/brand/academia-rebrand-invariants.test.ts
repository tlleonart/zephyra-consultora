/**
 * ACADEMIA REBRAND — structural guards.
 *
 * These are STATIC assertions on source text and computed colour maths, in the
 * same spirit (and for the same reason) as tests/unit/app/asset-proxy-*.test.ts:
 * the properties being guarded are structural or arithmetic, and both fail
 * SILENTLY in a browser.
 *
 *   1. L2 CONTAINMENT. The Arena skin must reach academia and nothing else. If a
 *      token leaks into :root, apps/www — which is contractually "moves as-is" —
 *      is repainted, and nothing goes red. The reviewer would have to eyeball
 *      the institutional site to find out.
 *   2. REVERSIBILITY. Four brand decisions are unratified (the lockup, the
 *      descriptor, the icon mark, the footer green). The requirement is not that
 *      they be documented as changeable, it is that each be a ONE-PLACE edit. A
 *      second hardcoded lockup path added six months from now would not break
 *      anything visible — it would just quietly make the swap expensive. Hence
 *      an enforced test rather than a comment.
 *   3. CONTRAST. AA ratios are arithmetic. Asserting them is cheap and it stops
 *      the warm text tokens from drifting back to the cool greys, which on the
 *      new paper background compute to 4.03:1 and 2.12:1.
 *
 * No DOM, no browser, no deployment: runs in the `test` CI job on every push.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const APP = path.resolve(__dirname, '../../..');
const REPO = path.resolve(APP, '../..');
const UI_STYLES = path.join(REPO, 'packages/ui/src/styles');

const read = (p: string) => fs.readFileSync(p, 'utf8');

/**
 * Comments quote the very things this task RETIRES — the old blue literal, the
 * old footer token, the forbidden names, the <link rel="icon"> that must not be
 * hand-written. Asserting their absence against raw text therefore fails on the
 * DOCUMENTATION of the fix, which is worse than not asserting at all. So every
 * "must not appear" check below reads CODE.
 */
const BLOCK_COMMENT = new RegExp(String.raw`/\*[\s\S]*?\*/`, 'g');
const LINE_COMMENT = new RegExp(String.raw`^\s*//.*$`, 'gm');
const code = (src: string) => src.replace(BLOCK_COMMENT, '').replace(LINE_COMMENT, '');

/** Every source file under a directory, with the build output excluded. */
function walk(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    // `.next` contains COMPILED copies of this same CSS. Including it produces
    // false positives on every token grep — it has already cost one wrong
    // measurement on this branch.
    if (entry.name === '.next' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, exts));
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

// ── contrast maths (WCAG 2.1 relative luminance) ────────────────────────────
function luminance(hex: string): number {
  const c = hex.replace('#', '');
  const channels = [0, 2, 4]
    .map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
function contrast(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
/** Pull a hex value out of a `--token: #RRGGBB;` declaration. */
function token(css: string, name: string): string {
  const m = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token ${name} not found (or not a literal hex)`);
  return m[1];
}

const THEME = read(path.join(UI_STYLES, 'theme-academia.css'));
const VARIABLES = read(path.join(UI_STYLES, 'variables.css'));
const ROOT_LAYOUT = read(path.join(APP, 'src/app/layout.tsx'));

describe('L1 — base corrections that all three apps inherit', () => {
  it('defines --color-brand-dark, which was referenced but never declared', () => {
    expect(token(VARIABLES, '--color-brand-dark')).toBe('#152B21');
  });

  it('leaves no consumer of the pre-existing undefined-token fallback', () => {
    // Both call sites read `var(--color-brand-dark, var(--color-brand-main))`,
    // so before this token existed the CTAs did not darken on hover at all.
    const fallbacks = walk(path.join(APP, 'src'), ['.css']).filter((f) =>
      code(read(f)).includes('--color-brand-dark, var(--color-brand-main)')
    );
    expect(fallbacks).toEqual([]);
  });

  it('retires the scaffold blue as an alias rather than a literal', () => {
    expect(VARIABLES).toMatch(/--color-primary:\s*var\(--color-brand-main\)/);
    expect(VARIABLES).toMatch(/--color-primary-hover:\s*var\(--color-brand-dark\)/);
    expect(code(VARIABLES)).not.toContain('#0066cc');
    expect(code(VARIABLES)).not.toContain('#0052a3');
  });

  it('has no academia call site left on the deprecated alias', () => {
    const users = walk(path.join(APP, 'src'), ['.css']).filter((f) =>
      code(read(f)).includes('--color-primary')
    );
    expect(users).toEqual([]);
  });
});

describe('L2 — the Arena skin reaches academia and nothing else', () => {
  it('scopes every rule in the theme to the attribute (never :root)', () => {
    const selectors = [...THEME.matchAll(/^([^\s@/*][^{]*)\{/gm)].map((m) => m[1].trim());
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      expect(selector).toContain("[data-theme='academia']");
    }
    expect(THEME).not.toMatch(/^:root/m);
  });

  it('is imported by the academia root layout only', () => {
    const importers = ['academia', 'www', 'backoffice'].filter((app) => {
      const dir = path.join(REPO, 'apps', app, 'src');
      if (!fs.existsSync(dir)) return false;
      return walk(dir, ['.ts', '.tsx']).some((f) =>
        read(f).includes('styles/theme-academia.css')
      );
    });
    expect(importers).toEqual(['academia']);
  });

  it('sets data-theme="academia" on <html> in academia, and in no other app', () => {
    expect(ROOT_LAYOUT).toMatch(/data-theme="academia"/);
    for (const app of ['www', 'backoffice']) {
      const layout = path.join(REPO, 'apps', app, 'src/app/layout.tsx');
      if (fs.existsSync(layout)) expect(read(layout)).not.toContain('data-theme');
    }
  });
});

describe('WCAG AA — the ratios the approved direction did not meet', () => {
  const paper = token(THEME, '--color-bg');
  const card = token(THEME, '--color-surface-card');

  it('paper and card surfaces are the Arena values', () => {
    expect(paper.toLowerCase()).toBe('#efeae0');
    expect(card.toLowerCase()).toBe('#fcfaf6');
  });

  it.each([
    ['--color-text', 4.5],
    ['--color-text-secondary', 4.5],
    ['--color-text-muted', 4.5],
    ['--color-success', 4.5],
    ['--color-warning', 4.5],
  ])('%s passes AA for small text on paper and on card', (name, threshold) => {
    const value = token(THEME, name);
    expect(contrast(value, paper)).toBeGreaterThanOrEqual(threshold);
    expect(contrast(value, card)).toBeGreaterThanOrEqual(threshold);
  });

  it('the cool greys it replaces would have FAILED — this is why they are here', () => {
    expect(contrast('#6b7280', paper)).toBeLessThan(4.5); // old text-secondary: 4.03:1
    expect(contrast('#9ca3af', paper)).toBeLessThan(4.5); // old text-muted:     2.12:1
    expect(contrast('#16a34a', card)).toBeLessThan(4.5); // old success:        3.16:1
    expect(contrast('#f59e0b', paper)).toBeLessThan(4.5); // old warning:        1.79:1
  });

  it('gives green bands a focus ring that is actually visible', () => {
    const ring = token(THEME, '--color-border-focus-inverse');
    const band = token(VARIABLES, '--color-brand-main');
    // A green ring on a green band is invisible; sand on #1E3C2E is 9.10:1.
    expect(contrast(ring, band)).toBeGreaterThanOrEqual(3);
  });

  it('keeps --color-brand-soft off body copy by documenting its limit', () => {
    // 4.83:1 on paper — AA for normal text by a thin margin, AAA fail. It is a
    // gradient-stop and decorative-rule colour, and the comment must say so.
    expect(contrast(token(VARIABLES, '--color-brand-soft'), paper)).toBeLessThan(7);
    expect(VARIABLES).toMatch(/NEVER body\s*\n?\s*(copy|\*\/)/i);
  });
});

describe('reversibility — every unratified decision is a one-place edit', () => {
  const appSources = walk(path.join(APP, 'src'), ['.ts', '.tsx']);

  it('D-1: only lib/brand.ts names a lockup or mark asset path', () => {
    const referrers = appSources
      .filter((f) => /\/images\/(brand\/)?(lockup-|zephyra-logo)/.test(read(f)))
      .map((f) => path.relative(APP, f).replace(/\\/g, '/'));
    expect(referrers).toEqual(['src/lib/brand.ts']);
  });

  it('D-1/D-2: only the Brandmark component reads the brand asset module', () => {
    const consumers = appSources
      .filter((f) => /BRAND_LOCKUP|BRAND_MARK|DESCRIPTOR_TREATMENT/.test(read(f)))
      .map((f) => path.relative(APP, f).replace(/\\/g, '/'))
      .filter((f) => f !== 'src/lib/brand.ts');
    expect(consumers).toEqual(['src/components/public/Brandmark/Brandmark.tsx']);
  });

  it('D-3: the icon is a file swap — no hand-written <link rel="icon">', () => {
    // The App Router file convention already emits the tags; hand-writing them
    // duplicates them, and it would also add a second place to edit.
    for (const f of appSources) {
      expect(code(read(f))).not.toMatch(/rel=["'](icon|apple-touch-icon|shortcut icon)["']/);
    }
  });

  it('D-4: the academia footer band is one declaration, and www keeps its token', () => {
    const footer = read(
      path.join(APP, 'src/components/public/Footer/Footer.module.css')
    );
    expect(footer).toMatch(/background-color: var\(--color-brand-main\);/);
    expect(code(footer)).not.toContain('--color-brand-footer');
    // Still defined, because apps/www's footer is its other consumer.
    expect(VARIABLES).toContain('--color-brand-footer');
  });
});

describe('the button contract — one visual system, any element', () => {
  const BUTTON_CSS = read(path.join(UI_STYLES, 'button.module.css'));
  const BTN_TS = read(path.join(UI_STYLES, 'btn.ts'));

  it('adds the two variants the approved direction needs', () => {
    expect(BUTTON_CSS).toMatch(/^\.inverse \{/m);
    expect(BUTTON_CSS).toMatch(/^\.outline \{/m);
    expect(BTN_TS).toContain("| 'inverse'");
    expect(BTN_TS).toContain("| 'outline'");
  });

  it('keeps the direction-specific flourishes out of the shared base', () => {
    // apps/backoffice renders <Button> everywhere and its only sanctioned change
    // this sprint is the colour remap, so weight/lift/ring must be theme-scoped.
    const base = BUTTON_CSS.slice(
      BUTTON_CSS.indexOf('.btn {'),
      BUTTON_CSS.indexOf('.btn:disabled')
    );
    expect(base).toContain('font-weight: 500');
    expect(base).not.toContain('transform');
    expect(BUTTON_CSS).toMatch(/\[data-theme='academia'\] \.btn \{\s*font-weight: 600;/);
  });

  it('is consumed by anchors, not imitated by them', () => {
    // The four M5.1 surfaces must not grow a second button system again.
    const surfaces = [
      'src/app/(public)/cursos/[slug]/page.tsx',
      'src/app/(public)/cursos/[slug]/compra/exito/page.tsx',
      'src/app/(public)/cursos/[slug]/compra/error/page.tsx',
      'src/app/(public)/cursos/[slug]/compra/pendiente/page.tsx',
    ];
    for (const rel of surfaces) {
      const src = read(path.join(APP, rel));
      expect(src).toContain('btnClass(');
    }
    // and the local reimplementations are gone
    const detail = read(
      path.join(APP, 'src/app/(public)/cursos/[slug]/CourseDetail.module.css')
    );
    expect(detail).not.toContain('.ctaButton');
    expect(detail).not.toMatch(/rgba\(0, 0, 0, 0\.25\)/);
  });

  it('renamed the .cta collision instead of merging incompatible elements', () => {
    const detail = read(
      path.join(APP, 'src/app/(public)/cursos/[slug]/CourseDetail.module.css')
    );
    const card = read(
      path.join(APP, 'src/components/public/CourseCard/CourseCard.module.css')
    );
    // `.cta` meant an <aside> panel here and an aria-hidden <span> there.
    expect(detail).toContain('.purchasePanel');
    expect(detail).not.toMatch(/^\.cta\b/m);
    expect(card).toContain('.cardAction');
    expect(card).not.toMatch(/^\.cta\b/m);
    // The <aside> is still an <aside> and the span is still aria-hidden.
    const page = read(path.join(APP, 'src/app/(public)/cursos/[slug]/page.tsx'));
    expect(page).toMatch(/<aside className=\{styles\.purchasePanel\}/);
    const cardTsx = read(
      path.join(APP, 'src/components/public/CourseCard/CourseCard.tsx')
    );
    expect(cardTsx).toMatch(/className=\{styles\.cardAction\} aria-hidden="true"/);
  });
});

describe('naming — Academia Zephyra, and the reserved words', () => {
  const publicSources = walk(path.join(APP, 'src/app/(public)'), ['.ts', '.tsx']);

  it('titles the app Academia Zephyra, not the institutional site', () => {
    expect(ROOT_LAYOUT).toContain('BRAND_NAME');
    expect(read(path.join(APP, 'src/lib/brand.ts'))).toMatch(
      /BRAND_NAME = 'Academia Zephyra'/
    );
    expect(ROOT_LAYOUT).not.toContain('Zephyra Consultora');
  });

  it('has no page metadata still branded as the institutional site', () => {
    for (const f of publicSources) {
      const titles = [...read(f).matchAll(/title:\s*["'`]([^"'`]*)["'`]/g)].map((m) => m[1]);
      for (const t of titles) expect(t).not.toContain('Zephyra Consultora');
    }
  });

  it('never says "Zephyra Academy", and never says campus to a user', () => {
    for (const f of walk(path.join(APP, 'src'), ['.ts', '.tsx'])) {
      const src = read(f);
      expect(code(src)).not.toContain('Zephyra Academy');
      // "CAMPUS" is the upstream content provider: a reserved word that may
      // appear in engineering comments and must never appear in UI copy.
      const jsxText = [...code(src).matchAll(/>([^<>{}]{3,})</g)].map((m) => m[1]);
      for (const text of jsxText) expect(text.toLowerCase()).not.toContain('campus');
    }
  });
});

describe('the PWA / favicon assets actually landed', () => {
  it('has the three file-convention icons, at the sizes Next requires', () => {
    for (const f of ['favicon.ico', 'icon.png', 'apple-icon.png']) {
      expect(fs.existsSync(path.join(APP, 'src/app', f))).toBe(true);
    }
    const png = (p: string) => {
      const b = fs.readFileSync(p);
      return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
    };
    // Apple requires exactly 180x180.
    expect(png(path.join(APP, 'src/app/apple-icon.png'))).toBe('180x180');
    expect(png(path.join(APP, 'src/app/icon.png'))).toBe('512x512');
  });

  it('has the manifest icons it references', () => {
    const manifest = read(path.join(APP, 'src/app/manifest.ts'));
    const srcs = [...manifest.matchAll(/src: '(\/icons\/[^']+)'/g)].map((m) => m[1]);
    expect(srcs.length).toBeGreaterThanOrEqual(3);
    for (const s of srcs) {
      expect(fs.existsSync(path.join(APP, 'public', s))).toBe(true);
    }
    expect(manifest).toContain('maskable');
  });

  it('ships the lockup variants the flattened contexts need', () => {
    const brandDir = path.join(APP, 'public/images/brand');
    const files = fs.readdirSync(brandDir);
    expect(files).toContain('lockup-academia-sand-on-transparent.png');
    expect(files).toContain('lockup-academia-green-on-transparent.png');
    // email header + certificates/OG use the pre-composed bands
    expect(files).toContain('email-header-green-band-1200x320.png');
  });
});

describe('the a11y compensation the blue retirement made mandatory', () => {
  it('underlines every link that used to be blue (WCAG 1.4.1)', () => {
    // Colour alone no longer distinguishes these: brand green is also the
    // heading and emphasis colour on the same screens.
    const forms = [
      'src/features/auth-learner/components/LearnerSigninForm/LearnerSigninForm.module.css',
      'src/features/auth-learner/components/LearnerSignupForm/LearnerSignupForm.module.css',
      'src/features/auth-learner/components/LearnerVerifyContent/LearnerVerifyContent.module.css',
      'src/features/org-signup/components/OrgSignupForm/OrgSignupForm.module.css',
      'src/features/org-signup/components/OrgCreateContent/OrgCreateContent.module.css',
    ];
    for (const rel of forms) {
      const css = read(path.join(APP, rel));
      const block = css.slice(css.indexOf('.footerLink {'));
      const decl = block.slice(0, block.indexOf('}'));
      expect(decl).toContain('text-decoration: underline');
      expect(decl).not.toContain('text-decoration: none');
    }
  });
});
