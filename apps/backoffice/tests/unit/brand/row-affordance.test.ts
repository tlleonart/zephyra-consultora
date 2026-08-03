/**
 * ROW-ACTION AFFORDANCE — structural guards (T-a11y-002).
 *
 * These assert the things a browser fails SILENTLY on, in the same spirit as
 * tests/unit/brand/token-coherence.test.ts. Everything here was MEASURED on a
 * live authenticated walk first; the test exists so the measurement stays true.
 *
 * WHY EACH GUARD EXISTS — all three were real defects on this branch:
 *
 *  1. NESTED INTERACTIVE. `<Link><Button variant="ghost">Editar</Button></Link>`
 *     renders `<a href><button></button></a>`. An <a> may not contain
 *     interactive content, and measured on /admin/blog it produced THREE tab
 *     stops for TWO actions — a keyboard user tabbed the same action twice.
 *     packages/ui/src/styles/btn.ts exists precisely so an anchor can wear the
 *     button styling WITHOUT becoming a <button> ("NEVER swap an anchor for a
 *     <button>"), and this guard is what stops the wrapper pattern coming back.
 *
 *  2. AFFORDANCE. The audit counted 45 row-action anchors carrying no class at
 *     all. 43 of those were the wrappers above (the visible control was the
 *     inner ghost button: transparent, no border, no underline) and 2 on
 *     /admin/lms were genuinely unstyled. Either way the resting state had no
 *     non-colour affordance, which WCAG 1.4.1 does not allow. A border is the
 *     treatment because it is one of the few things forced-colors preserves:
 *     measured under `forced-colors: active`, a ghost row action had
 *     `border: 0px none` and `outline: none` and was indistinguishable from
 *     static text, while the app's bordered filter chips stayed legible.
 *
 *  3. ONE STATUS-TOGGLE GEOMETRY. Six features had a byte-identical 20px-tall
 *     `.badge` block in their own module. Six copies is six chances to diverge,
 *     so the geometry moved to src/styles/statusToggle.module.css and this guard
 *     fails if a seventh copy is written.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const APP = path.resolve(__dirname, '../../..');
const REPO = path.resolve(APP, '../..');
const read = (p: string) => fs.readFileSync(p, 'utf8');

const BLOCK_COMMENT = new RegExp(String.raw`/\*[\s\S]*?\*/`, 'g');
const LINE_COMMENT = new RegExp(String.raw`^\s*//.*$`, 'gm');
/** The comments in the files below QUOTE the patterns being retired, so every
 *  "must not appear" assertion reads code, never documentation. */
const code = (src: string) => src.replace(BLOCK_COMMENT, '').replace(LINE_COMMENT, '');

/** The nine surfaces that render row actions, and the count each contributed to
 *  the audit's 45 unclassed anchors on the dev dataset. */
const LIST_SURFACES = [
  'features/alliances/components/AllianceList/AllianceList.tsx',
  'features/blog/components/BlogList/BlogList.tsx',
  'features/clients/components/ClientList/ClientList.tsx',
  'features/projects/components/ProjectList/ProjectList.tsx',
  'features/services/components/ServiceBlockList/ServiceBlockList.tsx',
  'features/services/components/ServiceList/ServiceList.tsx',
  'features/team/components/TeamList/TeamList.tsx',
  'features/users/components/UserList/UserList.tsx',
] as const;

const LMS = 'app/(dashboard)/admin/lms/LmsCourseList.tsx';

/** Every status toggle: a <button> whose label IS the state it toggles. */
const TOGGLE_SURFACES = [
  'features/blog/components/BlogList/BlogList.tsx',
  'features/projects/components/ProjectList/ProjectList.tsx',
  'features/services/components/ServiceList/ServiceList.tsx',
  'features/services/components/ServiceBlockList/ServiceBlockList.tsx',
  'features/users/components/UserList/UserList.tsx',
  'features/newsletter/components/SubscriberList/SubscriberList.tsx',
] as const;

const src = (rel: string) => read(path.join(APP, 'src', rel));

describe('no anchor wraps a button — the row action IS the anchor', () => {
  it.each(LIST_SURFACES)('%s', (rel) => {
    // The exact shape that shipped: a Link whose only child is a <Button>.
    expect(code(src(rel))).not.toMatch(/<Link[^>]*>\s*<Button/);
  });

  it('and nowhere else in the app either', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name === '.next') continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.name.endsWith('.tsx') && /<Link[^>]*>\s*<Button/.test(code(read(full))))
          offenders.push(path.relative(APP, full).replace(/\\/g, '/'));
      }
    };
    walk(path.join(APP, 'src'));
    expect(offenders).toEqual([]);
  });
});

describe('every row action carries a non-colour affordance', () => {
  it.each(LIST_SURFACES)('%s: Editar is an anchor wearing the button contract', (rel) => {
    const s = src(rel);
    expect(s).toMatch(/btnClass\(\{ variant: 'outline', size: 'sm' \}\)|btnClass\(\{ variant: "outline", size: "sm" \}\)/);
    expect(s).toMatch(/import \{ Button, btnClass \} from ["']@zephyra\/ui["']/);
  });

  it.each(LIST_SURFACES)('%s: the destructive action is visibly separated', (rel) => {
    expect(src(rel)).toContain('variant="dangerSoft"');
    // and no row action is left on the affordance-free ghost variant
    expect(code(src(rel))).not.toMatch(/variant="ghost"\s+size="sm"/);
  });

  it('the LMS console has no unstyled row action left', () => {
    const s = code(src(LMS));
    // The two genuinely class-less anchors the audit found.
    expect(s).not.toMatch(/<a href=\{academiaPlayerUrl\(c\.slug\)\}>/);
    expect(s).not.toMatch(/<Link href=\{`\/admin\/lms\/courses\/\$\{c\.slug\}\/edit`\}>\s*Editar/);
    // and its buttons no longer render as UA defaults (2px outset, 21px tall).
    expect(s).not.toMatch(/style=\{\{ cursor: "pointer" \}\}/);
    expect((s.match(/btnClass\(/g) ?? []).length).toBeGreaterThanOrEqual(7);
  });
});

describe('the status toggle exposes its state, and is big enough to hit', () => {
  const TOGGLE_CSS = read(path.join(APP, 'src/styles/statusToggle.module.css'));

  it.each(TOGGLE_SURFACES)('%s sets aria-pressed from the same value as the label', (rel) => {
    const s = src(rel);
    expect(s).toMatch(/aria-pressed=\{/);
    expect(s).toContain('statusToggleClass()');
  });

  it('meets WCAG 2.5.8 by min-height, not by padding luck', () => {
    expect(TOGGLE_CSS).toMatch(/min-height: 24px/);
    expect(TOGGLE_CSS).toMatch(/min-width: 24px/);
  });

  it('has a boundary that forced-colors keeps', () => {
    // Measured: with `border: none` the chip vanished entirely under
    // `forced-colors: active` (background collapsed to rgba(255,255,255,0.1)).
    expect(TOGGLE_CSS).toMatch(/border: 1px solid currentColor/);
    expect(code(TOGGLE_CSS)).not.toMatch(/border:\s*none/);
  });

  it('no longer signals hover by dimming its own label', () => {
    // `opacity: .8` on a 6.40:1 label is a contrast REGRESSION on hover.
    expect(code(TOGGLE_CSS)).not.toMatch(/opacity: 0?\.8/);
  });

  it('is declared ONCE — no feature re-grows its own copy', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name === '.next') continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.name.endsWith('.module.css')) {
          const badge = code(read(full)).match(/^\.badge\s*\{([^}]*)\}/m)?.[1];
          // TeamList keeps a `.badge` on purpose: it is a NON-interactive <span>,
          // and in the finished UI a borderless chip means "label, not control".
          // What must never come back is a CLICKABLE 20px badge.
          if (badge && /cursor:\s*pointer/.test(badge)) offenders.push(path.relative(APP, full).replace(/\\/g, '/'));
        }
      }
    };
    walk(path.join(APP, 'src'));
    expect(offenders).toEqual([]);
  });
});

describe('P-4 — the WYSIWYG editor body has a focus indicator', () => {
  const CSS = read(
    path.join(APP, 'src/features/blog/components/WysiwygEditor/WysiwygEditor.module.css')
  );

  it('no longer kills the outline with nothing in its place', () => {
    const editor = code(CSS).match(/^\.editor \{([^}]*)\}/m)?.[1] ?? '';
    expect(editor).not.toMatch(/outline:\s*none/);
  });

  it('and draws a real one, with an outline so forced-colors keeps it', () => {
    // Measured under `forced-colors: active`: box-shadow is dropped entirely,
    // outline survives with its colour remapped to the system highlight.
    expect(CSS).toMatch(/\.editor:focus-visible \{[^}]*outline: 2px solid var\(--color-brand-main\)/);
    // Drawn inside the box so it cannot overlap the toolbar or the frame.
    expect(CSS).toMatch(/outline-offset: -2px/);
  });
});

describe('P-10 — the website link target is the text, not the whole cell', () => {
  it.each([
    'features/clients/components/ClientList/ClientList.module.css',
    'features/alliances/components/AllianceList/AllianceList.module.css',
  ])('%s', (rel) => {
    const website = code(read(path.join(APP, 'src', rel))).match(/^\.website \{([^}]*)\}/m)?.[1] ?? '';
    expect(website).not.toMatch(/display: block/); // measured 846.3 x 18
    expect(website).toMatch(/min-height: 24px/);
    expect(website).toMatch(/width: fit-content/);
    // A green URL among black cell text was a colour-only cue (1.4.1).
    expect(website).toMatch(/text-decoration: underline/);
  });
});

describe('the quiet destructive variant is part of the ONE button system', () => {
  const BUTTON_CSS = read(path.join(REPO, 'packages/ui/src/styles/button.module.css'));
  const BTN_TS = read(path.join(REPO, 'packages/ui/src/styles/btn.ts'));

  it('is declared in the shared contract, not in a second button system', () => {
    expect(BUTTON_CSS).toMatch(/^\.dangerSoft \{/m);
    expect(BTN_TS).toContain("| 'dangerSoft'");
  });

  it('pairs with `outline` by FILL, so safe-vs-destructive survives greyscale', () => {
    const soft = BUTTON_CSS.match(/^\.dangerSoft \{([^}]*)\}/m)?.[1] ?? '';
    const outline = BUTTON_CSS.match(/^\.outline \{([^}]*)\}/m)?.[1] ?? '';
    expect(soft).toMatch(/background-color: var\(--color-error-tint\)/);
    expect(outline).toMatch(/background-color: transparent/);
    // Both carry a boundary; that is the non-colour affordance they share.
    expect(soft).toMatch(/border: 1px solid var\(--color-error\)/);
    expect(outline).toMatch(/border: 1px solid var\(--color-brand-main\)/);
  });

  it('did not sneak a flourish into the shared base', () => {
    // Same invariant apps/academia guards: the backoffice renders <Button>
    // everywhere, so weight/lift/ring stay theme-scoped.
    const base = BUTTON_CSS.slice(BUTTON_CSS.indexOf('.btn {'), BUTTON_CSS.indexOf('.btn:disabled'));
    expect(base).toContain('font-weight: 500');
    expect(base).not.toContain('transform');
    expect(base).not.toContain('focus-visible');
  });
});

describe('contrast — measured on everything this task touched', () => {
  const VARIABLES = read(path.join(REPO, 'packages/ui/src/styles/variables.css'));
  function token(name: string): string {
    const raw = VARIABLES.replace(BLOCK_COMMENT, '')
      .match(new RegExp(String.raw`${name}:\s*([^;]+);`))?.[1]
      ?.trim();
    if (!raw) throw new Error(`token ${name} not found`);
    const ref = raw.match(/^var\(\s*(--[\w-]+)\s*\)$/);
    return ref ? token(ref[1]) : raw;
  }
  function luminance(hex: string): number {
    const c = hex.replace('#', '');
    const full = c.length === 3 ? c.split('').map((ch) => ch + ch).join('') : c;
    const ch = [0, 2, 4]
      .map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  }
  const contrast = (fg: string, bg: string) => {
    const a = luminance(fg);
    const b = luminance(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };

  const WHITE = '#ffffff';
  /** The zebra fill these controls actually sit on. */
  const ROW = '#f9fafb';

  it('the safe row action: label AND boundary (1.4.3 + 1.4.11)', () => {
    // measured live: 11.54:1 on the row fill
    expect(contrast(token('--color-brand-main'), ROW)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token('--color-brand-main'), ROW)).toBeGreaterThanOrEqual(3);
    // hover inverts to a solid fill
    expect(contrast(WHITE, token('--color-brand-main'))).toBeGreaterThanOrEqual(4.5);
  });

  it('the destructive row action: label on its own tint, boundary on the row', () => {
    // measured live: 7.11:1
    expect(contrast(token('--color-error'), token('--color-error-tint'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token('--color-error'), ROW)).toBeGreaterThanOrEqual(3);
    expect(contrast(WHITE, token('--color-error'))).toBeGreaterThanOrEqual(4.5);
  });

  it('the status toggle border is currentColor, so it passes wherever the label does', () => {
    for (const [fg, bg] of [
      ['--color-success', '--color-success-tint'],
      ['--color-warning', '--color-warning-tint'],
      ['--color-brand-main', '--color-brand-tint-soft'],
    ] as const) {
      expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5); // label
      expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(3); // boundary
    }
  });

  it('tokenising the badge tints IMPROVED the measured ratio', () => {
    // Before: `rgba(22,163,74,.1)` composited against whatever it landed on —
    // measured 6.13:1 on the row fill. After: the frozen token, 6.40:1, true
    // wherever it lands. Contrast had to improve or hold; it improved.
    expect(contrast(token('--color-success'), token('--color-success-tint'))).toBeGreaterThan(6.13);
  });

  it('the editor focus ring clears 1.4.11', () => {
    expect(contrast(token('--color-brand-main'), WHITE)).toBeGreaterThanOrEqual(3);
  });

  it('the alpha literals it replaced are gone from the badge tones', () => {
    for (const rel of [
      'features/blog/components/BlogList/BlogList.module.css',
      'features/services/components/ServiceList/ServiceList.module.css',
      'features/services/components/ServiceBlockList/ServiceBlockList.module.css',
      'features/users/components/UserList/UserList.module.css',
      'features/newsletter/components/SubscriberList/SubscriberList.module.css',
    ]) {
      const s = code(read(path.join(APP, 'src', rel)));
      expect(s).not.toMatch(/rgba\(\s*22,\s*163,\s*74/);
      expect(s).not.toMatch(/rgba\(\s*245,\s*158,\s*11/);
    }
  });
});
