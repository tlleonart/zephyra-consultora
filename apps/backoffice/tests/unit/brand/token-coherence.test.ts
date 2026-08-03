/**
 * TOKEN COHERENCE — the guard that four earlier measurements could not be (T-a11y-001).
 *
 * M5 retired the scaffold blue by re-pointing --color-primary to brand green. Four
 * separate token-reference counts then reported the retirement complete. All four
 * were STRUCTURALLY BLIND to the same thing: the companion background tints were
 * authored as LITERALS pairing with the blue (rgba(0,102,204,.1) /
 * rgba(59,130,246,.1)), so no alias could reach them and no count of token
 * references could see them. The backoffice shipped a two-palette chrome on every
 * screen — the active sidebar pill was a blue pill carrying green text.
 *
 * So this file asserts BOTH SIDES OF THE PAIR:
 *   1. no scaffold-blue literal survives anywhere in apps/** or packages/**;
 *   2. the AA-corrected feedback/text tokens live at L1 (the layer all three apps
 *      inherit) with values that actually pass, and are NOT re-declared at L2 —
 *      two declarations of one token is how backoffice and www ended up shipping
 *      the failing values while academia was fixed;
 *   3. the LMS console carries no inline hex, because inline JSX is the one place
 *      a token change can never reach.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(__dirname, '../../../../..');
const UI_STYLES = path.join(REPO, 'packages/ui/src/styles');
const VARIABLES = fs.readFileSync(path.join(UI_STYLES, 'variables.css'), 'utf8');
const THEME = fs.readFileSync(path.join(UI_STYLES, 'theme-academia.css'), 'utf8');

const BLOCK_COMMENT = new RegExp(String.raw`/\*[\s\S]*?\*/`, 'g');
const LINE_COMMENT = new RegExp(String.raw`^\s*//.*$`, 'gm');
const code = (src: string) => src.replace(BLOCK_COMMENT, '').replace(LINE_COMMENT, '');

/** `.next` holds COMPILED copies of the same CSS — a scan that includes it
 *  reports false positives on every literal and every token alike. */
function walk(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.next' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, exts));
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

const SOURCES = [
  ...walk(path.join(REPO, 'apps'), ['.css', '.ts', '.tsx']),
  ...walk(path.join(REPO, 'packages'), ['.css', '.ts', '.tsx']),
].filter((f) => !f.includes(`${path.sep}tests${path.sep}`));

function luminance(hex: string): number {
  const c = hex.replace('#', '');
  const full = c.length === 3
    ? c.split('').map((ch) => ch + ch).join('')
    : c;
  const channels = [0, 2, 4]
    .map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
function contrast(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
function token(css: string, name: string): string | undefined {
  return code(css)
    .match(new RegExp(String.raw`${name}:\s*([^;]+);`))?.[1]
    ?.trim();
}

/**
 * NOTATION BLIND SPOT (T-e2e-020) — the third structurally blind measurement of
 * this sprint. The first: `var()` counts could not see the literals paired with
 * the token. The second: a build-artifact cache reported stale CSS as current.
 * The third: the superadmin badge was authored `rgb(147, 51, 234)` /
 * `rgba(147, 51, 234, .1)` — THE SAME COLOUR IN A DIFFERENT NOTATION — and every
 * hex-based scan in the sprint, this guard included, was blind to it.
 *
 * So the guard no longer pattern-matches notations. It CANONICALISES every colour
 * literal it finds — hex in any case and any length (3/4/6/8), rgb(), rgba(),
 * hsl(), hsla() — down to #rrggbb, and compares values. A retired colour cannot
 * come back by being spelled differently.
 */
type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb | null {
  let c = hex.replace('#', '').toLowerCase();
  if (c.length === 3 || c.length === 4) {
    c = c
      .slice(0, 3)
      .split('')
      .map((ch) => ch + ch)
      .join('');
  } else if (c.length === 6 || c.length === 8) {
    c = c.slice(0, 6);
  } else return null;
  if (!/^[0-9a-f]{6}$/.test(c)) return null;
  return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16)) as Rgb;
}

/** hsl -> rgb, so `hsl(210 100% 40%)` cannot hide `#0066cc`. */
function hslToRgb(h: number, s: number, l: number): Rgb {
  const S = s / 100;
  const L = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)] as Rgb;
}

const toHex = ([r, g, b]: Rgb) =>
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`;

/** Every colour literal in `src`, canonicalised to #rrggbb (alpha dropped:
 *  rgba(0,102,204,.1) and #0066cc are the SAME retired colour). */
function canonicalColours(src: string): Set<string> {
  const out = new Set<string>();
  for (const m of src.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    const rgb = hexToRgb(m[0]);
    if (rgb) out.add(toHex(rgb));
  }
  // Both legacy comma syntax and modern space syntax, with or without alpha.
  for (const m of src.matchAll(
    /\b(rgba?|hsla?)\(\s*([0-9.]+)(?:deg)?%?[\s,]+([0-9.]+)%?[\s,]+([0-9.]+)%?/gi
  )) {
    const fn = m[1].toLowerCase();
    const [a, b, c] = [Number(m[2]), Number(m[3]), Number(m[4])];
    if (![a, b, c].every(Number.isFinite)) continue;
    out.add(toHex(fn.startsWith('hsl') ? hslToRgb(a, b, c) : ([a, b, c] as Rgb)));
  }
  return out;
}

describe('the scaffold blue is retired on BOTH sides of the pair', () => {
  // Canonical values, not notations. rgba(0,102,204,.1), rgb(0 102 204),
  // hsl(210,100%,40%), #06c and #0066CCFF are all THE SAME retired colour now.
  const BLUE = new Set(['#0066cc', '#0052a3', '#3b82f6']);

  it('has no scaffold-blue LITERAL left in any source file, in ANY notation', () => {
    const offenders: string[] = [];
    for (const file of SOURCES) {
      const found = canonicalColours(code(fs.readFileSync(file, 'utf8')));
      const hits = [...found].filter((c) => BLUE.has(c));
      if (hits.length) offenders.push(`${path.relative(REPO, file)} → ${hits.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('the canonicaliser actually sees through notation — the blind spot, proven closed', () => {
    // Each of these is #0066cc wearing a different costume. A guard that has not
    // been shown to catch these is the guard we already shipped once.
    for (const spelling of [
      '#0066cc',
      '#0066CC',
      '#06c',
      '#0066ccff',
      'rgb(0, 102, 204)',
      'rgba(0,102,204,.1)',
      'rgb(0 102 204)',
      'hsl(210, 100%, 40%)',
      'hsla(210 100% 40% / 10%)',
    ]) {
      expect(
        [...canonicalColours(`color: ${spelling};`)].some((c) => BLUE.has(c)),
        `${spelling} slipped past the canonicaliser`
      ).toBe(true);
    }
    // …and does not invent hits: the brand green is not the retired blue.
    expect([...canonicalColours('color: rgb(30, 60, 46);')].some((c) => BLUE.has(c))).toBe(false);
  });

  it('replaced them with tokens, not with new literals', () => {
    // The tint and the focus ring are the two roles the blue literals played.
    expect(token(VARIABLES, '--color-brand-tint-soft')).toBe('#e9ecea');
    expect(token(VARIABLES, '--color-focus-ring')).toBe('rgba(30, 60, 46, 0.15)');
    // Nobody may reintroduce a raw brand-green rgba() at a backoffice or shared-UI
    // call site instead — that is how the blue literals happened in the first place.
    // apps/www is deliberately excluded: its 13 rgba(30,60,46,…) uses are MULTI-STOP
    // gradient overlays over photography, which an opaque token cannot express, and
    // www is out of scope for restyling ("www moves as-is").
    const scoped = path.join(REPO, 'apps', 'backoffice') + path.sep;
    const shared = path.join(REPO, 'packages', 'ui') + path.sep;
    const raw = SOURCES.filter(
      (f) =>
        f.endsWith('.css') &&
        !f.startsWith(UI_STYLES) &&
        (f.startsWith(scoped) || f.startsWith(shared)) &&
        /rgba\(\s*30\s*,\s*60\s*,\s*46/i.test(code(fs.readFileSync(f, 'utf8')))
    );
    expect(raw.map((f) => path.relative(REPO, f))).toEqual([]);
  });

  it('keeps the active sidebar pill on one palette', () => {
    const sidebar = fs.readFileSync(
      path.join(REPO, 'apps/backoffice/src/features/dashboard/components/Sidebar/Sidebar.module.css'),
      'utf8'
    );
    const active = code(sidebar).match(/\.navItem\.active\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(active).toContain('var(--color-brand-tint-soft)');
    expect(active).toContain('var(--color-primary)');
    // Green text on the green tint, measured: 10.14:1.
    expect(
      contrast(token(VARIABLES, '--color-brand-main')!, token(VARIABLES, '--color-brand-tint-soft')!)
    ).toBeGreaterThan(4.5);
  });
});

describe('the AA corrections live at L1, once', () => {
  const WHITE = '#ffffff';
  const PROMOTED = [
    '--color-text-secondary',
    '--color-text-muted',
    '--color-success',
    '--color-warning',
    '--color-error',
  ] as const;

  it.each(PROMOTED)('%s passes AA for small text on white at L1', (name) => {
    const value = token(VARIABLES, name)!;
    expect(value).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(contrast(value, WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(PROMOTED)('%s is not re-declared at L2 — one source of truth', (name) => {
    expect(token(THEME, name)).toBeUndefined();
  });

  it('the values it replaced were the failures — this is why the promotion happened', () => {
    expect(contrast('#9ca3af', WHITE)).toBeLessThan(4.5); // old text-muted 2.54:1
    expect(contrast('#16a34a', WHITE)).toBeLessThan(4.5); // old success    3.30:1
    expect(contrast('#f59e0b', WHITE)).toBeLessThan(4.5); // old warning    2.15:1
  });

  it('status-badge text passes on the .1 green tint the badges actually use', () => {
    // The badges are `background: rgba(22,163,74,.1); color: var(--color-success)`.
    // rgba(22,163,74,.1) over white composites to #e8f6ed. P-3.
    expect(contrast(token(VARIABLES, '--color-success')!, '#e8f6ed')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('P-1 — the LMS console has no inline colour literal left, in any notation', () => {
  it.each([
    'apps/backoffice/src/app/(dashboard)/admin/lms/LmsCourseList.tsx',
    // T-e2e-020: the earlier P-1 work covered LmsCourseList only. This one
    // carried `color: "#6b7280"` twice in inline style objects — unguarded, and
    // inline JSX is the one place a token change can never reach.
    'apps/backoffice/src/app/(dashboard)/admin/lms/courses/[slug]/edit/CourseMetaForm.tsx',
  ])('%s', (rel) => {
    const src = code(fs.readFileSync(path.join(REPO, rel), 'utf8'));
    expect([...canonicalColours(src)]).toEqual([]);
  });

  it('the CourseMetaForm swap improved contrast — it did not just move the value', () => {
    // #6b7280 on white = 4.83:1 (passing, but untokenised and unreachable).
    // --color-text-secondary = #4a453b = 8.55:1. Strictly better, and now one
    // source of truth.
    expect(contrast(token(VARIABLES, '--color-text-secondary')!, '#ffffff')).toBeGreaterThan(
      contrast('#6b7280', '#ffffff')
    );
  });

  /**
   * KNOWN, RECORDED, NOT SILENCED. ScormUploadForm.tsx (the internal SCORM
   * upload tool at /admin/lms/courses/new) carries ~20 inline literals across
   * its whole layout — greys, an error card, a success card, a terminal-style
   * log panel. Tokenising it is a restyle of a screen with no design assets, not
   * a guard fix, so it is OUT of T-e2e-020's scope and left for a task that owns
   * the screen. It is listed HERE, in the guard, rather than left as an unowned
   * blind spot: the assertion pins the current offender set, so the file cannot
   * quietly grow more, and any OTHER backoffice component that starts carrying
   * inline colour fails this test immediately.
   */
  it('no OTHER backoffice component carries an inline colour literal', () => {
    const KNOWN_UNTOKENISED = ['apps/backoffice/src/app/(dashboard)/admin/lms/courses/new/ScormUploadForm.tsx'];
    const offenders = walk(path.join(REPO, 'apps/backoffice/src'), ['.tsx'])
      .filter((f) => canonicalColours(code(fs.readFileSync(f, 'utf8'))).size > 0)
      .map((f) => path.relative(REPO, f).split(path.sep).join('/'));
    expect(offenders).toEqual(KNOWN_UNTOKENISED);
  });

  it('every backoffice checkbox declares accent-color — the UA blue has no door left', () => {
    // TeamForm was the one that did not (T-e2e-020): its checked fill rendered
    // UA blue. The colour is never authored, so no colour scan can ever see it —
    // only the ABSENCE of the declaration is observable.
    const forms = walk(path.join(REPO, 'apps/backoffice/src/features'), ['.module.css']).filter(
      (f) => /\.checkbox\s+input/.test(fs.readFileSync(f, 'utf8'))
    );
    expect(forms.length).toBeGreaterThanOrEqual(5);
    const missing = forms
      .filter((f) => !/accent-color:\s*var\(--color-primary\)/.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(REPO, f));
    expect(missing).toEqual([]);
  });

  it('white on the primary action clears AA — it was 1.8:1 on #2d7', () => {
    expect(contrast('#ffffff', token(VARIABLES, '--color-brand-main')!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#ffffff', '#22dd77')).toBeLessThan(4.5);
  });
});
