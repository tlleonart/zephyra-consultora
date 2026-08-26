/**
 * T-06 (M-HOME) — structural + contrast guards for the new home surfaces
 * (hero, "Explorá por temática" chips, banda B2B). Same rationale as
 * m5-surfaces-invariants.test.ts: what AC 12 asks for (AA contrast) and
 * what §3/§6 of the spec ask for (exact approved copy, no out-of-scope
 * features) both fail SILENTLY in a browser — the page renders, it just
 * renders wrong. This is the automatable half of those checks; AC 1/3/4/6
 * are verified live in a browser (see the task's closing report) because
 * they depend on real Convex data, which this workspace's suite — no
 * jsdom, no live Convex in unit tests — cannot exercise.
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
function toHex(n: number): string {
  return Math.round(Math.min(255, Math.max(0, n)))
    .toString(16)
    .padStart(2, '0');
}
/** Alpha-composite an rgba(255,255,255,alpha) foreground over an opaque hex
 *  background — i.e. what a browser actually paints for translucent text,
 *  which is the pair WCAG contrast must be measured on, not the pre-blend
 *  channel values. */
function compositeWhiteOver(alpha: number, bgHex: string): string {
  const c = bgHex.replace('#', '');
  const [br, bgc, bb] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
  const blend = (bgChannel: number) => alpha * 255 + (1 - alpha) * bgChannel;
  return `#${toHex(blend(br))}${toHex(blend(bgc))}${toHex(blend(bb))}`;
}
function token(css: string, name: string): string {
  const m = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token ${name} not found (or not a literal hex)`);
  return m[1];
}
function effective(name: string): string {
  const look = (css: string) =>
    code(css)
      .match(new RegExp(String.raw`${name}:\s*([^;]+);`))?.[1]
      ?.trim();
  const raw = look(THEME) ?? look(VARIABLES);
  if (!raw) throw new Error(`token ${name} declared at neither L2 nor L1`);
  const ref = raw.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  if (ref) return effective(ref[1]);
  if (!/^#[0-9a-fA-F]{6}$/.test(raw))
    throw new Error(`token ${name} is not a literal hex: ${raw}`);
  return raw;
}

const THEME = read(path.join(UI_STYLES, 'theme-academia.css'));
const VARIABLES = read(path.join(UI_STYLES, 'variables.css'));

const HOME_TSX = read(path.join(APP, 'src/app/(public)/page.tsx'));
const HOME_CSS = read(path.join(APP, 'src/app/(public)/Home.module.css'));
const CURSOS_TSX = read(path.join(APP, 'src/app/(public)/cursos/page.tsx'));

describe('home hero — approved copy, no out-of-scope features', () => {
  it('renders the exact client-approved hero title (spec §3.1 — do not reword)', () => {
    expect(HOME_TSX).toContain('Aprender es el primer paso del cambio');
  });

  it('renders the exact client-approved B2B band title (spec §3.4)', () => {
    expect(HOME_TSX).toContain('Formá a tu equipo con packs a medida');
  });

  it('the primary CTA points at /cursos and the secondary at /empresa', () => {
    expect(HOME_TSX).toMatch(/href="\/cursos"[\s\S]{0,200}Explorá el catálogo/);
    expect(HOME_TSX).toMatch(/href="\/empresa"[\s\S]{0,80}Para tu organización/);
  });

  it('does not mount the pack calculator on the B2B band (spec §3.4 — puerta, no herramienta)', () => {
    const band = HOME_TSX.slice(HOME_TSX.indexOf('bandSection'));
    expect(band).not.toContain('PackCalculator');
    expect(band).not.toContain('Calculadora');
  });

  it('excludes every feature spec §3.5 names as out of scope', () => {
    const forbiddenStrings = [
      'type="search"',
      'placeholder="Buscá',
      'Paginación',
      'testimonio',
      'Testimonio',
      'inscriptos',
    ];
    for (const needle of forbiddenStrings) {
      expect(HOME_TSX).not.toContain(needle);
    }
    expect(HOME_TSX).not.toMatch(/<select[^>]*orden/i);
  });

  it('reuses CourseCard as-is — no new card variant', () => {
    expect(HOME_TSX).toContain('CourseCard');
    expect(HOME_TSX).not.toMatch(/CourseCard\w+Variant|HomeCourseCard/);
  });

  it('reuses the exact same empty-catalog state as /cursos, not a second one', () => {
    expect(HOME_TSX).toContain('EmptyCoursesState');
    expect(CURSOS_TSX).toContain('EmptyCoursesState');
  });
});

describe('T-06 AC 4 — a topic with zero published courses renders no chip', () => {
  it('derives chip slugs from listPublishedTopics, not a hardcoded taxonomy list', () => {
    expect(HOME_TSX).toContain('api.lms.courses.listPublishedTopics');
    // The whole section — including its <h2>Explorá por temática</h2> — is
    // gated on there being at least one topic slug; there is no fallback
    // branch that renders the heading with zero chips underneath.
    const gate = HOME_TSX.slice(
      HOME_TSX.indexOf('topicSlugs.length > 0'),
      HOME_TSX.indexOf('Explorá por temática') + 40
    );
    expect(gate).toContain('topicSlugs.length > 0');
  });
});

describe('T-06 AC 5 — /cursos?tema=X is not a separate indexable URL', () => {
  it('declares a STATIC canonical on /cursos pointing at the clean path', () => {
    // A static `metadata` export (as opposed to `generateMetadata`) applies
    // identically to every request against this route regardless of query
    // string, so one declaration covers /cursos and every /cursos?tema=X.
    expect(CURSOS_TSX).toMatch(/canonical:\s*`\$\{SITE_URL\}\/cursos`/);
    expect(CURSOS_TSX).not.toContain('export async function generateMetadata');
  });

  it('the catalog reads tema from searchParams and queries listPublishedByTopic', () => {
    expect(CURSOS_TSX).toContain('searchParams: Promise<{ tema?: string }>');
    expect(CURSOS_TSX).toContain('api.lms.courses.listPublishedByTopic');
    // AC 4's contract note: the slug-validation stays in Ronan's query, not
    // reimplemented here.
    expect(code(CURSOS_TSX)).not.toMatch(/TOPIC_SLUGS|isTopicSlug/);
  });
});

describe('the home declares its own canonical (/ is canonical of itself)', () => {
  it('/ points its canonical at the bare site origin', () => {
    expect(HOME_TSX).toMatch(/canonical:\s*SITE_URL/);
  });
});

describe('AC 12 — contrast AA on the three new surfaces', () => {
  // The hero and the B2B band are the SAME dark-green gradient (documented
  // deviation from the mockup's light hero paint, see the header comment in
  // Home.module.css) — brand-main is the lighter of its two stops, so it is
  // the worst-case background for white/near-white text.
  const GREEN_WORST_CASE = () => token(VARIABLES, '--color-brand-main');

  it('hero title/lead are solid or near-solid white on the worst-case green stop', () => {
    const bg = GREEN_WORST_CASE();
    expect(contrast('#FFFFFF', bg)).toBeGreaterThan(4.5); // .title
    expect(contrast(compositeWhiteOver(0.9, bg), bg)).toBeGreaterThan(4.5); // .lead
    expect(contrast(compositeWhiteOver(0.85, bg), bg)).toBeGreaterThan(4.5); // .eyebrow
  });

  it('the secondary hero CTA (translucent white link) clears 4.5:1', () => {
    const bg = GREEN_WORST_CASE();
    expect(contrast(compositeWhiteOver(0.85, bg), bg)).toBeGreaterThan(4.5);
  });

  it('the B2B band title/body clear AA on the same worst-case stop', () => {
    const bg = GREEN_WORST_CASE();
    expect(contrast('#FFFFFF', bg)).toBeGreaterThan(4.5); // .bandTitle
    expect(contrast(compositeWhiteOver(0.9, bg), bg)).toBeGreaterThan(4.5); // .bandText
    expect(contrast(compositeWhiteOver(0.85, bg), bg)).toBeGreaterThan(4.5); // .bandEyebrow
  });

  it('the inverse CTA button (white fill, brand text) clears AA on the band/hero', () => {
    // btnClass({variant:'inverse'}) — button.module.css: #ffffff bg, brand-main text.
    expect(contrast(effective('--color-brand-main'), '#FFFFFF')).toBeGreaterThan(4.5);
  });

  it('the chip text clears AA on the card surface it sits on', () => {
    const chipBg = token(THEME, '--color-surface-card');
    expect(contrast(effective('--color-text-secondary'), chipBg)).toBeGreaterThan(4.5);
  });

  it('the chip hover/focus state (brand text on card) clears AA', () => {
    const chipBg = token(THEME, '--color-surface-card');
    expect(contrast(effective('--color-brand-main'), chipBg)).toBeGreaterThan(4.5);
  });

  it('uses only tokens for every new colour — no undocumented literal hex', () => {
    // rgba(255,255,255,x) on the green bands is the SAME pattern
    // CourseDetail.module.css already uses for its hero (.backLink); no new
    // literal colour family is introduced.
    const literals = (code(HOME_CSS).match(/#[0-9a-fA-F]{3,8}/g) ?? []).filter(
      (h) => h.toLowerCase() !== '#ffffff'
    );
    expect(literals).toEqual([]);
  });
});
