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

describe('the scaffold blue is retired on BOTH sides of the pair', () => {
  const BLUE = [
    /rgba\(\s*0\s*,\s*102\s*,\s*204/i,
    /rgba\(\s*59\s*,\s*130\s*,\s*246/i,
    /#0066cc/i,
    /#0052a3/i,
    /#3b82f6/i,
  ];

  it('has no scaffold-blue LITERAL left in any source file', () => {
    const offenders: string[] = [];
    for (const file of SOURCES) {
      const src = code(fs.readFileSync(file, 'utf8'));
      if (BLUE.some((re) => re.test(src))) offenders.push(path.relative(REPO, file));
    }
    expect(offenders).toEqual([]);
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

describe('P-1 — the LMS console has no inline hex left', () => {
  it.each([
    'apps/backoffice/src/app/(dashboard)/admin/lms/LmsCourseList.tsx',
  ])('%s', (rel) => {
    const src = code(fs.readFileSync(path.join(REPO, rel), 'utf8'));
    expect(src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });

  it('white on the primary action clears AA — it was 1.8:1 on #2d7', () => {
    expect(contrast('#ffffff', token(VARIABLES, '--color-brand-main')!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#ffffff', '#22dd77')).toBeLessThan(4.5);
  });
});
