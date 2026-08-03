/**
 * MOBILE NAV + TARGET SIZE — structural guards (T-a11y-003).
 *
 * Same spirit as token-coherence.test.ts and row-affordance.test.ts: assert the
 * things a browser fails SILENTLY on. All three defect classes below were real on
 * this branch and were measured on a live authenticated walk at 375px first.
 *
 *  1. P-8. `.sidebar.open` existed in DashboardLayout.module.css and NOTHING in
 *     the tree ever set it — no control, no state. So below 1024px the sidebar was
 *     off-canvas with no way back and the backoffice had zero reachable nav
 *     destinations on a phone. A CSS escape hatch nobody can reach is the failure
 *     mode this guard exists for: it pins the control, its labelled state, and the
 *     two structural decisions that make it work at runtime.
 *
 *  2. P-9. The superadmin role badge was `rgb(147,51,234)` on `rgba(147,51,234,.1)`
 *     — 4.45:1, under the 4.5:1 small-text threshold, and INVISIBLE to a hex grep
 *     because it was authored in rgb()/rgba(). token-coherence.test.ts scans for
 *     hex and for two specific blue rgba() shapes; neither could see this. So this
 *     asserts the pair is now tokens, and that the tokens pass.
 *
 *  3. WCAG 2.5.8. Six native checkboxes, five sized 18x18 and one — the LMS course
 *     meta form — carrying no sizing at all, i.e. the UA default, smaller still.
 *     The brief named four; the sixth and the unstyled one were found by looking.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(__dirname, '../../../../..');
const read = (rel: string) => fs.readFileSync(path.join(REPO, rel), 'utf8');

const LAYOUT_DIR = 'apps/backoffice/src/components/layout/DashboardLayout';
const LAYOUT_TSX = read(`${LAYOUT_DIR}/DashboardLayout.tsx`);
const LAYOUT_CSS = read(`${LAYOUT_DIR}/DashboardLayout.module.css`);
const VARIABLES = read('packages/ui/src/styles/variables.css');
const THEME = read('packages/ui/src/styles/theme-academia.css');

const BLOCK_COMMENT = new RegExp(String.raw`/\*[\s\S]*?\*/`, 'g');
const code = (src: string) => src.replace(BLOCK_COMMENT, '');
const token = (css: string, name: string) =>
  code(css).match(new RegExp(String.raw`${name}:\s*([^;]+);`))?.[1]?.trim();

function luminance(hex: string): number {
  const c = hex.replace('#', '');
  const full = c.length === 3 ? c.split('').map((ch) => ch + ch).join('') : c;
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

describe('P-8 — the mobile nav control exists and is reachable', () => {
  const mediaBlock = LAYOUT_CSS.slice(LAYOUT_CSS.indexOf('@media (max-width: 1024px)'));

  it('something actually sets .open — the class is no longer dead CSS', () => {
    expect(LAYOUT_CSS).toContain('.sidebar.open');
    expect(code(LAYOUT_TSX)).toContain('styles.open');
    expect(code(LAYOUT_TSX)).toContain('useState');
  });

  it('the control is a real button with a labelled, announced state', () => {
    const c = code(LAYOUT_TSX);
    expect(c).toContain('type="button"');
    expect(c).toContain('aria-expanded={isNavOpen}');
    expect(c).toContain('aria-controls={SIDEBAR_ID}');
    // T-a11y-002 established a state-bearing accessible name satisfies 4.1.2;
    // both are present here, so the state survives either reading.
    expect(c).toMatch(/aria-label=\{isNavOpen \? 'Cerrar[^']*' : 'Abrir[^']*'\}/);
  });

  it('exists ONLY below the breakpoint where the sidebar is unreachable', () => {
    const base = LAYOUT_CSS.slice(
      LAYOUT_CSS.indexOf('.navToggle {'),
      LAYOUT_CSS.indexOf('.navToggle:hover')
    );
    expect(base).toContain('display: none');
    expect(mediaBlock).toMatch(/\.navToggle \{[^}]*display: inline-flex/);
    expect(mediaBlock).toMatch(/\.backdrop \{[^}]*display: block/);
    const backdropBase = LAYOUT_CSS.slice(
      LAYOUT_CSS.indexOf('.backdrop {'),
      LAYOUT_CSS.indexOf('.content {')
    );
    expect(backdropBase).toContain('display: none');
  });

  it('the affordance is a border and the focus indicator an outline, never a shadow', () => {
    // forced-colors: active drops box-shadow and keeps border/outline (measured in
    // T-a11y-002), so a shadow would evaporate for exactly the wrong users.
    const toggleRules = LAYOUT_CSS.slice(
      LAYOUT_CSS.indexOf('.navToggle {'),
      LAYOUT_CSS.indexOf('.backdrop {')
    );
    expect(toggleRules).not.toContain('box-shadow');
    expect(toggleRules).toMatch(/border: 1px solid var\(--color-primary\)/);
    expect(toggleRules).toMatch(/\.navToggle:focus-visible \{[^}]*outline: 2px solid/);
    // 1.4.11: the boundary that identifies the control needs 3:1. The first choice
    // was --color-border-strong and it measured 1.47:1 on the white header.
    expect(contrast(token(VARIABLES, '--color-brand-main')!, '#ffffff')).toBeGreaterThanOrEqual(3);
    expect(contrast(token(VARIABLES, '--color-border-strong')!, '#ffffff')).toBeLessThan(3);
  });

  it('the off-canvas panel leaves the tab order instead of hiding off-screen', () => {
    expect(mediaBlock).toMatch(/\.sidebar \{[^}]*visibility: hidden/);
    expect(mediaBlock).toMatch(/\.sidebar\.open \{[^}]*visibility: visible/);
    // Asymmetric on purpose: instant on open (or the panel is painted but not yet
    // hittable and its first tap falls through to the scrim), delayed on close so
    // the slide-out stays visible.
    expect(mediaBlock).toMatch(/\.sidebar\.open \{[^}]*visibility 0s;/);
    expect(mediaBlock).toMatch(/\.sidebar \{[^}]*visibility 0s linear 200ms/);
  });

  it('the control precedes the panel in DOM order, so forward Tab reaches the nav', () => {
    const c = code(LAYOUT_TSX);
    expect(c.indexOf('className={styles.navToggle}')).toBeLessThan(c.indexOf('id={SIDEBAR_ID}'));
    // No JS focus management: it could not be demonstrated at runtime, and DOM
    // order needs none. If someone adds it back, they must prove it works.
    expect(c).not.toContain('requestAnimationFrame');
  });

  it('the toggle is not a child of the sticky header — that stacking context ate it', () => {
    const c = code(LAYOUT_TSX);
    const toggleAt = c.indexOf('className={styles.navToggle}');
    const headerAt = c.indexOf('className={styles.header}');
    expect(toggleAt).toBeLessThan(headerAt);
    // .header is a stacking context (position: sticky + z-index), so a z-index on a
    // descendant is resolved inside it and loses to the scrim in the parent.
    expect(LAYOUT_CSS).toMatch(/\.header \{[^}]*z-index: 10/);
    expect(mediaBlock).toMatch(/\.navToggle \{[^}]*z-index: 60/);
    expect(mediaBlock).toMatch(/\.backdrop \{[^}]*z-index: 40/);
  });

  it('closes on link activation, not only on a pathname change', () => {
    // Tapping the entry for the route you are already on does not change the
    // pathname, so the effect alone left the panel open over the page.
    expect(code(LAYOUT_TSX)).toContain('handleSidebarActivate');
    expect(code(LAYOUT_TSX)).toContain("closest('a')");
    expect(code(LAYOUT_TSX)).toContain("event.key !== 'Escape'");
  });

  it('the scrim colour is a token, not another literal rgba() at a call site', () => {
    expect(token(VARIABLES, '--color-overlay-scrim')).toBe('rgba(17, 24, 39, 0.45)');
    expect(LAYOUT_CSS).toContain('var(--color-overlay-scrim)');
    expect(code(LAYOUT_CSS)).not.toMatch(/rgba\(/);
  });
});

describe('P-9 — the superadmin role badge', () => {
  const USER_LIST = read(
    'apps/backoffice/src/features/users/components/UserList/UserList.module.css'
  );
  const PURPLE = /rgba?\(\s*147\s*,\s*51\s*,\s*234/i;

  it('no longer carries the failing literal on either side of the pair', () => {
    expect(PURPLE.test(code(USER_LIST))).toBe(false);
    const rule = code(USER_LIST).match(/\.superadmin\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toContain('var(--color-role-superadmin-tint)');
    expect(rule).toContain('var(--color-role-superadmin)');
  });

  it('the tokens live at L1 once, and pass AA for small text', () => {
    const fg = token(VARIABLES, '--color-role-superadmin')!;
    const bg = token(VARIABLES, '--color-role-superadmin-tint')!;
    expect(fg).toBe('#6b21a8');
    expect(bg).toBe('#f0e9f6');
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    // One source of truth — two declarations is how the failing values shipped.
    expect(token(THEME, '--color-role-superadmin')).toBeUndefined();
    expect(token(THEME, '--color-role-superadmin-tint')).toBeUndefined();
  });

  it('the value it replaced was the failure — 4.45:1, which is why this happened', () => {
    // rgba(147,51,234,.1) over the #f9fafb table surface composites to #efe6f9.
    expect(contrast('#9333ea', '#efe6f9')).toBeLessThan(4.5);
  });

  it('the two roles are still told apart by more than a shade of one hue', () => {
    const admin = token(VARIABLES, '--color-brand-main')!;
    expect(token(VARIABLES, '--color-role-superadmin')).not.toBe(admin);
  });
});

describe('WCAG 2.5.8 — every native checkbox meets the 24x24 minimum', () => {
  // Six call sites, found by grepping for the control rather than by trusting the
  // list of four in the brief. Five were 18x18; the LMS one had no sizing at all.
  const SIZED = [
    'apps/backoffice/src/features/projects/components/ProjectForm/ProjectForm.module.css',
    'apps/backoffice/src/features/services/components/ServiceForm/ServiceForm.module.css',
    'apps/backoffice/src/features/services/components/ServiceBlockForm/ServiceBlockForm.module.css',
    'apps/backoffice/src/features/team/components/TeamForm/TeamForm.module.css',
    'apps/backoffice/src/features/users/components/UserForm/UserForm.module.css',
  ] as const;

  it.each(SIZED)('%s sizes its checkbox at 24px, not 18px', (rel) => {
    const rule = code(read(rel)).match(/\.checkbox input(?:\[type="checkbox"\])?\s*\{([^}]*)\}/)?.[1];
    expect(rule).toBeDefined();
    expect(rule).toContain('width: 24px');
    expect(rule).toContain('height: 24px');
    expect(rule).not.toContain('18px');
  });

  it('the LMS course meta checkbox is sized too — it had none, so it was the smallest', () => {
    const src = read(
      'apps/backoffice/src/app/(dashboard)/admin/lms/courses/[slug]/edit/CourseMetaForm.tsx'
    );
    const at = src.indexOf('type="checkbox"');
    expect(at).toBeGreaterThan(-1);
    expect(src.slice(at, at + 240)).toContain('width: 24, height: 24');
  });

  it('there are exactly six, so a seventh cannot slip in unmeasured', () => {
    const dirs = ['apps/backoffice/src'];
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === '.next' || e.name === 'node_modules') continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.tsx$/.test(e.name)) files.push(full);
      }
    };
    for (const d of dirs) walk(path.join(REPO, d));
    const sites = files.filter((f) => fs.readFileSync(f, 'utf8').includes('type="checkbox"'));
    expect(sites.length).toBe(6);
  });
});
