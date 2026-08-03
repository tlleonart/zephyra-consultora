/**
 * M5.2 SURFACES — structural guards for the player chrome, the Org-Admin console
 * and the three transactional emails (T-fe-014).
 *
 * Same rationale as academia-rebrand-invariants.test.ts: everything asserted here
 * fails SILENTLY in a browser or an inbox.
 *
 *   1. THE SCORM BRIDGE. The player works because the iframe is same-origin with
 *      the page and the CAMPUS content can walk `window.parent`. Restyling the
 *      chrome cannot be allowed to reparent the iframe, wrap it, portal it, or
 *      collapse the stage to zero height. Break any of those and the course still
 *      RENDERS — only progress stops persisting. No console error, no red test.
 *      apps/academia/tests/unit/app/asset-proxy-same-origin.test.ts already pins
 *      the relative src and the sandbox attribute; this pins the STRUCTURE.
 *   2. NO LITERAL HOST IN AN EMAIL. An email cannot resolve a relative image, so
 *      the pressure to hardcode `zephyraconsultora.com` is real and permanent.
 *      apps/www's suite fails the build on the host literal; this asserts the
 *      positive form — every template derives its origin from the URL it is
 *      handed.
 *   3. D-1 STILL COSTS ONE EDIT. The payment email lives in packages/convex,
 *      which CANNOT import apps/academia/src — so its palette and lockup path are
 *      a deliberate mirror. Unpinned, that mirror is a second edit point. Pinned,
 *      a lockup swap that misses one side goes red.
 *   4. CONTRAST on the pills, the KPI band and the danger action.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const APP = path.resolve(__dirname, '../../..');
const REPO = path.resolve(APP, '../..');
const UI_STYLES = path.join(REPO, 'packages/ui/src/styles');

const read = (p: string) => fs.readFileSync(p, 'utf8');
const BLOCK_COMMENT = new RegExp(String.raw`/\*[\s\S]*?\*/`, 'g');
const LINE_COMMENT = new RegExp(String.raw`^\s*//.*$`, 'gm');
const code = (src: string) => src.replace(BLOCK_COMMENT, '').replace(LINE_COMMENT, '');

function walk(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    // `.next` holds COMPILED copies of the same CSS — including it produces
    // false positives on every token grep.
    if (entry.name === '.next' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, exts));
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

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
function token(css: string, name: string): string {
  const m = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token ${name} not found (or not a literal hex)`);
  return m[1];
}

const THEME = read(path.join(UI_STYLES, 'theme-academia.css'));
const PLAYER_DIR = 'src/app/(public)/cursos/[slug]/player';
const PLAYER_TSX = read(path.join(APP, PLAYER_DIR, 'ScormPlayer.tsx'));
const PLAYER_CSS = read(path.join(APP, PLAYER_DIR, 'ScormPlayer.module.css'));
const PLAYER_LAYOUT = read(path.join(APP, PLAYER_DIR, 'layout.tsx'));
const PLAYER_LAYOUT_CSS = read(path.join(APP, PLAYER_DIR, 'layout.module.css'));

describe('the SCORM bridge survives the chrome restyle', () => {
  it("keeps <main className={styles.main}> as the iframe's IMMEDIATE parent", () => {
    // The whole premise. If a wrapper appears between .main and the <iframe>,
    // the ancestor chain the CAMPUS wrapper walks changes and progress stops
    // persisting — with the course still painting perfectly.
    const stage = PLAYER_TSX.slice(PLAYER_TSX.indexOf('<main className={styles.main}>'));
    const openMain = stage.indexOf('>');
    const iframe = stage.indexOf('<iframe');
    const between = stage.slice(openMain + 1, iframe);
    // Only JSX braces, the conditional and whitespace/comments may sit between.
    expect(code(between)).not.toMatch(/<[a-zA-Z]/);
  });

  it('never portals, modals or transforms the stage', () => {
    // createPortal moves the iframe to another DOM subtree — window.parent then
    // resolves somewhere else entirely. A CSS transform/filter on an ancestor
    // creates a containing block, which is survivable, but on the stage itself it
    // is a smell; assert the hard ones.
    expect(code(PLAYER_TSX)).not.toContain('createPortal');
    expect(code(PLAYER_TSX)).not.toContain('react-dom/client');
    for (const css of [PLAYER_CSS, PLAYER_LAYOUT_CSS]) {
      expect(code(css)).not.toMatch(/\.main\s*\{[^}]*(transform|filter|perspective)\s*:/);
    }
  });

  it('keeps the full-viewport shell (fixed/inset-0) and gives the stage height', () => {
    // A zero-height stage renders a blank course that still "works".
    expect(PLAYER_LAYOUT_CSS).toMatch(/position:\s*fixed/);
    expect(PLAYER_LAYOUT_CSS).toMatch(/inset:\s*0/);
    // And it must actually WIN. The (public) Navbar is fixed at
    // z-index: var(--z-dropdown) = 100; the shell shipped at a literal 50, so
    // the institutional Navbar painted over the course title from T-fe-008 until
    // this task. Asserting the TOKEN, not a number, is what stops them drifting.
    expect(PLAYER_LAYOUT_CSS).toMatch(/z-index:\s*var\(--z-modal\)/);
    expect(code(PLAYER_LAYOUT_CSS)).not.toMatch(/z-index:\s*\d+/);
    expect(PLAYER_CSS).toMatch(/\.player\s*\{[^}]*height:\s*100vh/);
    expect(PLAYER_CSS).toMatch(/\.iframe\s*\{[^}]*height:\s*100%/);
    expect(PLAYER_CSS).toMatch(/\.main\s*\{[^}]*flex:\s*1/);
  });

  it('the shell is one element with no literal inline styles left', () => {
    // The four inline literals moved to a CSS Module on the SAME element, which
    // is why the ancestor chain is byte-identical.
    expect(PLAYER_LAYOUT).toContain('className={styles.shell}');
    expect(code(PLAYER_LAYOUT)).not.toMatch(/style=\{\{/);
  });

  it('the chrome is tokens only — the 16 literal colours are gone', () => {
    // The player was the one learner-facing surface the rebrand could not reach
    // through tokens: #fff, #fafafa, #e5e5e5, #2d7, #eee, #888, #f4f4f4, #eefbf2,
    // #c5ecd4. Only #ffffff-on-green (a fixed foreground on a fixed fill) may stay.
    const literals = (code(PLAYER_CSS).match(/#[0-9a-fA-F]{3,8}/g) ?? []).filter(
      (h) => h.toLowerCase() !== '#ffffff'
    );
    expect(literals).toEqual([]);
  });

  it('the progress bar and rail use the tokens the delta reserved for them', () => {
    expect(PLAYER_CSS).toMatch(/\.progressTrack\s*\{[^}]*var\(--color-bg-tertiary\)/);
    expect(PLAYER_CSS).toContain('var(--color-surface-card)');
    expect(PLAYER_CSS).toContain('var(--color-brand-soft)'); // the dashed SCORM frame
  });

  it('completion is announced in text, not by dot colour alone (WCAG 1.4.1)', () => {
    expect(PLAYER_TSX).toContain('className={styles.srOnly}>Completado');
    expect(PLAYER_TSX).toMatch(/aria-hidden="true"\s*\n\s*className=\{`\$\{styles\.navDot\}/);
  });

  it('has an exit affordance, because the shell hides the Navbar', () => {
    // Full-viewport + no chrome meant the browser back button was the only way
    // out. The exit points at the course page, so leaving is reversible.
    expect(PLAYER_TSX).toMatch(/href=\{`\/cursos\/\$\{slug\}`\}/);
  });
});

describe('the Org-Admin console consumes the button contract, not a copy of it', () => {
  const surfaces = [
    'src/app/(empresa)/empresa/page.tsx',
    'src/app/(empresa)/empresa/compra/exito/page.tsx',
    'src/app/(empresa)/empresa/compra/pendiente/page.tsx',
    'src/app/(empresa)/empresa/compra/error/page.tsx',
    'src/features/org-dashboard/components/OrgDashboard/OrgDashboard.tsx',
    'src/features/org-dashboard/components/InviteDialog/InviteDialog.tsx',
    'src/features/org-dashboard/components/NominalProgressDialog/NominalProgressDialog.tsx',
    'src/features/seats/components/ClaimContent/ClaimContent.tsx',
    'src/features/packs/components/PackCalculator/PackCalculator.tsx',
    `${PLAYER_DIR}/ScormPlayer.tsx`,
  ];

  it('every M5.2 surface calls btnClass()', () => {
    for (const rel of surfaces) {
      expect(read(path.join(APP, rel)), rel).toContain('btnClass(');
    }
  });

  it('closes the last two .cta collisions the delta named', () => {
    // `.cta` meant a <Link> in Console.module.css and a <button> in
    // ClaimContent.module.css — one name, two elements. Both retired.
    const console_ = read(path.join(APP, 'src/app/(empresa)/empresa/Console.module.css'));
    const claim = read(
      path.join(APP, 'src/features/seats/components/ClaimContent/ClaimContent.module.css')
    );
    expect(console_).not.toMatch(/^\.cta\b/m);
    expect(claim).not.toMatch(/^\.cta\b/m);
    // and the elements did NOT change to fit the style
    expect(read(path.join(APP, 'src/app/(empresa)/empresa/page.tsx'))).toMatch(
      /<Link href="\/empresa\/cursos" className=\{btnClass/
    );
  });

  it('leaves no hand-rolled button fill behind on those surfaces', () => {
    // A local `background-color: var(--color-brand-main)` + `color: white` pair
    // IS a reimplemented primary button. Six of them existed.
    const modules = walk(path.join(APP, 'src/app/(empresa)'), ['.module.css'])
      .concat(walk(path.join(APP, 'src/features/org-dashboard'), ['.module.css']))
      .concat(walk(path.join(APP, 'src/features/packs'), ['.module.css']))
      .concat(walk(path.join(APP, 'src/features/seats'), ['.module.css']));
    for (const f of modules) {
      const src = code(read(f));
      const rel = path.relative(APP, f).replace(/\\/g, '/');
      // The topbar band and the roster avatar are legitimately green fills; they
      // are not buttons and they carry no button geometry (padding + radius-md).
      const reimplemented =
        /background-color:\s*var\(--color-brand-main\);[\s\S]{0,200}?border-radius:\s*var\(--radius-md\)/.test(
          src
        );
      expect(reimplemented, rel).toBe(false);
    }
  });

  it('replaced the faint focus ring that failed non-text contrast', () => {
    // rgba(30,60,46,.35) over the card computes to ~2.24:1 — below the 3:1 that
    // WCAG 1.4.11 requires of a focus indicator. Solid brand green is 11.57:1.
    const modules = walk(path.join(APP, 'src'), ['.module.css']);
    for (const f of modules) {
      expect(code(read(f)), path.relative(APP, f)).not.toMatch(
        /rgba\(30,\s*60,\s*46,\s*0?\.35\)/
      );
    }
  });

  it('the green topbar band resolves focus rings to sand, not green-on-green', () => {
    const layout = read(path.join(APP, 'src/app/(empresa)/layout.module.css'));
    expect(layout).toMatch(/--btn-focus-color:\s*var\(--color-border-focus-inverse\)/);
    expect(layout).toContain('var(--color-border-focus-inverse)');
  });

  it('renders the lockup through <Brandmark/> instead of a typed wordmark', () => {
    const layout = read(path.join(APP, 'src/app/(empresa)/layout.tsx'));
    expect(layout).toContain('<Brandmark');
    // The old markup spelled the wordmark as live text inside the brand link.
    expect(layout).not.toMatch(/className=\{styles\.brand\}>\s*\n\s*Zephyra/);
  });

  it('does NOT surface nominal progress in the roster (privacy by design)', () => {
    // The mockup's roster carries per-person progress bars and status pills. The
    // product deliberately does not: nominal progress is consent-gated behind
    // NominalProgressDialog. A density pass must not smuggle it into the table.
    const dash = read(
      path.join(APP, 'src/features/org-dashboard/components/OrgDashboard/OrgDashboard.tsx')
    );
    const roster = dash.slice(dash.indexOf('<caption'));
    expect(roster).not.toContain('progressPercent');
    expect(roster).not.toContain('styles.pmini');
    expect(roster).not.toMatch(/styles\.pill/);
  });
});

describe('status pills — AA on their own tints', () => {
  const CARD = () => token(THEME, '--color-surface-card');

  it('freezes the direction’s rgba tints as opaque tokens', () => {
    // An alpha fill composites against whatever it lands on (card, paper or
    // sand), so the measured ratio would depend on the parent. Opaque makes the
    // number true everywhere.
    for (const t of [
      '--color-success-tint',
      '--color-warning-tint',
      '--color-brand-tint-soft',
      '--color-error-tint',
    ]) {
      expect(THEME).toMatch(new RegExp(`${t}:\\s*#[0-9a-fA-F]{6}`));
    }
  });

  it('pill text passes 4.5:1 on its own tint — the mockup values did not', () => {
    const pairs: Array<[string, string, number]> = [
      ['--color-success-text', '--color-success-tint', 5.8],
      ['--color-warning-text', '--color-warning-tint', 5.6],
    ];
    for (const [fg, bg, min] of pairs) {
      expect(contrast(token(THEME, fg), token(THEME, bg))).toBeGreaterThan(min);
    }
    // brand-main is defined in L1, so read it from the pill's own perspective.
    expect(contrast('#1E3C2E', token(THEME, '--color-brand-tint-soft'))).toBeGreaterThan(9);
  });

  it('the raw mockup colours are STILL failures — this is why the pair exists', () => {
    // #15803D on the success tint = 4.14:1, #B45309 on the warning tint = 4.00:1.
    expect(contrast('#15803D', token(THEME, '--color-success-tint'))).toBeLessThan(4.5);
    expect(contrast('#B45309', token(THEME, '--color-warning-tint'))).toBeLessThan(4.5);
  });

  it('--color-error was ALSO a failure, and is fixed at the token', () => {
    // Nobody had named this one: L1 #dc2626 on the error tint is 4.41:1 and on
    // the card only 4.63:1. Academia has exactly one error FILL and it is
    // white-on-error, so darkening improves that too (4.83:1 -> 8.31:1).
    const err = token(THEME, '--color-error');
    expect(contrast(err, token(THEME, '--color-error-tint'))).toBeGreaterThan(4.5);
    expect(contrast(err, CARD())).toBeGreaterThan(4.5);
    expect(contrast('#FFFFFF', err)).toBeGreaterThan(4.5);
    expect(contrast('#dc2626', token(THEME, '--color-error-tint'))).toBeLessThan(4.5);
  });

  it('the KPI band and roster avatar are AA on their surfaces', () => {
    // KPI value: brand green on card. Avatar: white on brand green.
    expect(contrast('#1E3C2E', CARD())).toBeGreaterThan(4.5);
    expect(contrast('#FFFFFF', '#1E3C2E')).toBeGreaterThan(4.5);
    // The seat utilisation bar sits on sand and is bounded by border-strong.
    expect(contrast('#1E3C2E', token(THEME, '--color-bg-secondary'))).toBeGreaterThan(3);
  });
});

describe('transactional emails — the lockup, the band, and no literal host', () => {
  const EMAIL_DIR = path.join(APP, 'src/emails');
  const templates = ['LearnerMagicLink.tsx', 'SeatInvite.tsx'];
  const CHROME = read(path.join(EMAIL_DIR, '_chrome.tsx'));
  const CONVEX_EMAIL = read(
    path.join(REPO, 'packages/convex/convex/lms/payment/email.ts')
  );
  const BRAND = read(path.join(APP, 'src/lib/brand.ts'));

  it('no template reintroduces a literal host', () => {
    // This is the regression apps/www's suite fails the build over. Asserted
    // here in the positive too: the origin comes from the URL the caller passed.
    for (const t of templates) {
      const src = read(path.join(EMAIL_DIR, t));
      expect(src, t).not.toContain('zephyraconsultora.com');
      expect(src, t).toContain('emailOriginFrom(');
    }
    expect(CHROME).not.toContain('zephyraconsultora.com');
    // The convex template derives it from the playerUrl it already composes.
    const body = CONVEX_EMAIL.slice(
      CONVEX_EMAIL.indexOf('const confirmationEmailHtml'),
      CONVEX_EMAIL.indexOf('const confirmationEmailText')
    );
    expect(body).not.toContain('zephyraconsultora.com');
    expect(body).toContain('new URL(props.playerUrl).origin');
  });

  it('all three carry the green band header with the lockup', () => {
    expect(CHROME).toContain('EMAIL_PALETTE.green');
    expect(CHROME).toContain('brandEmailLockup(');
    for (const t of templates) {
      expect(read(path.join(EMAIL_DIR, t)), t).toContain('<EmailHeader origin={origin} />');
    }
    // The convex one uses a table cell bgcolor — the only band construct Outlook
    // honours. A background-IMAGE band renders white when images are blocked.
    expect(CONVEX_EMAIL).toMatch(/bgcolor="\$\{EMAIL_GREEN\}"/);
    expect(CONVEX_EMAIL).toContain('alt="Academia Zephyra"');
    expect(code(CONVEX_EMAIL)).not.toMatch(/background-image/);
    expect(CHROME).not.toMatch(/backgroundImage/);
  });

  it('the image-blocked state still shows the brand (alt text on the band)', () => {
    // Every major client blocks remote images on first open. The alt text is
    // styled sand-on-green (9.10:1), not default black-on-green.
    expect(CHROME).toContain('EMAIL_PALETTE.sand');
    expect(CONVEX_EMAIL).toContain('color:${EMAIL_SAND}');
  });

  it('D-1 is STILL one edit: brand.ts owns the only asset path in the app', () => {
    const appSources = walk(path.join(APP, 'src'), ['.ts', '.tsx']);
    const referrers = appSources
      .filter((f) => /\/images\/(brand\/)?(lockup-|zephyra-logo)/.test(read(f)))
      .map((f) => path.relative(APP, f).replace(/\\/g, '/'));
    expect(referrers).toEqual(['src/lib/brand.ts']);
  });

  it('pins the convex mirror to brand.ts, because convex cannot import src', () => {
    // packages/convex bundles only the convex/ tree — the `@/` alias does not
    // exist there. So the palette and lockup path are re-declared. Unpinned that
    // is a SECOND edit point for D-1; pinned, a swap that misses one goes red.
    const lockupPath = BRAND.match(/onDark:\s*'(\/images\/brand\/lockup-[^']+)'/);
    expect(lockupPath, 'BRAND_LOCKUP.onDark not found in brand.ts').toBeTruthy();
    expect(CONVEX_EMAIL).toContain(`EMAIL_LOCKUP_PATH = "${lockupPath![1]}"`);

    const palette = (name: string) => {
      const m = BRAND.match(new RegExp(`${name}:\\s*'(#[0-9A-Fa-f]{6})'`));
      if (!m) throw new Error(`EMAIL_PALETTE.${name} missing`);
      return m[1];
    };
    const mirror: Array<[string, string]> = [
      ['green', 'EMAIL_GREEN'],
      ['paper', 'EMAIL_PAPER'],
      ['card', 'EMAIL_CARD'],
      ['sand', 'EMAIL_SAND'],
      ['text', 'EMAIL_TEXT'],
      ['textSecondary', 'EMAIL_TEXT_SECONDARY'],
      ['border', 'EMAIL_BORDER'],
    ];
    for (const [jsName, convexName] of mirror) {
      expect(CONVEX_EMAIL, convexName).toContain(`${convexName} = "${palette(jsName)}"`);
    }
  });

  it('the email palette matches the theme tokens it represents', () => {
    // Email cannot read a custom property, so these are literals — which means
    // they can drift from the theme silently. They cannot now.
    const pal = (name: string) =>
      BRAND.match(new RegExp(`${name}:\\s*'(#[0-9A-Fa-f]{6})'`))![1].toLowerCase();
    expect(pal('paper')).toBe(token(THEME, '--color-bg').toLowerCase());
    expect(pal('card')).toBe(token(THEME, '--color-surface-card').toLowerCase());
    expect(pal('sand')).toBe(token(THEME, '--color-bg-secondary').toLowerCase());
    expect(pal('textSecondary')).toBe(token(THEME, '--color-text-secondary').toLowerCase());
    expect(pal('border')).toBe(token(THEME, '--color-border').toLowerCase());
  });

  it('says Academia Zephyra, and the sender name follows', () => {
    for (const t of templates) {
      expect(read(path.join(EMAIL_DIR, t)), t).not.toMatch(/Zephyra Academy|\bLMS\b/);
    }
    expect(read(path.join(APP, 'src/lib/mailer/learner.ts'))).toContain(
      '"Academia Zephyra" <'
    );
    expect(CONVEX_EMAIL).toContain('"Academia Zephyra" <');
    // The ADDRESS is unchanged — guide §8.4 fixes the sender address.
    expect(CONVEX_EMAIL).toContain('process.env.EMAIL_USER');
  });

  it('email body copy is AA on the card it sits on', () => {
    const pal = (name: string) =>
      BRAND.match(new RegExp(`${name}:\\s*'(#[0-9A-Fa-f]{6})'`))![1];
    expect(contrast(pal('text'), pal('card'))).toBeGreaterThan(4.5);
    expect(contrast(pal('textSecondary'), pal('card'))).toBeGreaterThan(4.5);
    expect(contrast(pal('green'), pal('card'))).toBeGreaterThan(4.5);
    expect(contrast('#FFFFFF', pal('green'))).toBeGreaterThan(4.5);
    expect(contrast(pal('sand'), pal('green'))).toBeGreaterThan(4.5);
  });
});
