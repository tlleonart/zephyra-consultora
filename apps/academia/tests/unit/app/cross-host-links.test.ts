/**
 * CROSS-HOST LINK BOUNDARY — structural guards.
 *
 * WHY THIS EXISTS. The split copied the public Navbar and Footer into this app
 * with their hrefs unchanged (boundaries v1.1 §3.1 keeps routes byte-identical).
 * Those hrefs were RELATIVE and pointed at routes www owns — so on academia's
 * host all of them 404'd. Measured on the deployed staging build: six navbar
 * links, five footer links, both logo lockups, the 404 page's own "volver al
 * inicio" button, the error page's, and the 50+-seat B2B enquiry CTA. Fifteen
 * dead links, and the two worst were structural rather than cosmetic:
 *
 *   - Every dead nav link lands the visitor on not-found.tsx, whose only button
 *     ALSO 404'd. There was no way out except editing the address bar.
 *   - The PackCalculator CTA is on the money path: a buyer reading "escribinos y
 *     coordinamos el precio" clicked through to nothing.
 *
 * WHY A TEST AND NOT A COMMENT. This class of defect fails INVISIBLY. The page
 * renders, the markup is valid, the link looks right, and nothing goes red —
 * it breaks only when a human clicks. Nobody re-adding `href="/proyectos"` to a
 * component in this app would see a failure without this file. The same is true
 * in the other direction, which is why the inverse is asserted too: an
 * over-correction that made academia's OWN links absolute would break the SCORM
 * same-origin premise, and that also fails silently.
 *
 * No DOM, no browser, no deployment: runs in the `test` CI job on every push.
 * Its live companion is tests/e2e/scorm-player-premise.spec.ts.
 */
import { describe, expect, it, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const APP = path.resolve(__dirname, '../../..');
const SRC = path.join(APP, 'src');

/**
 * Strip comments before asserting ABSENCE. The comments added alongside this fix
 * quote the very hrefs being retired (`href="/"`, `/contacto`, …), so a raw-text
 * assertion would fail on the DOCUMENTATION of the fix rather than on a
 * regression — the same trap tests/unit/brand/academia-rebrand-invariants.ts
 * already had to solve.
 */
const BLOCK_COMMENT = new RegExp(String.raw`/\*[\s\S]*?\*/`, 'g');
const LINE_COMMENT = new RegExp(String.raw`^\s*//.*$`, 'gm');
const JSX_COMMENT = new RegExp(String.raw`\{\s*/\*[\s\S]*?\*/\s*\}`, 'g');
const code = (src: string) =>
  src.replace(JSX_COMMENT, '').replace(BLOCK_COMMENT, '').replace(LINE_COMMENT, '');

const walk = (dir: string, out: string[] = []): string[] => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      walk(p, out);
    } else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) {
      out.push(p);
    }
  }
  return out;
};

const FILES = walk(SRC);
const rel = (p: string) => path.relative(APP, p).replace(/\\/g, '/');

/**
 * Routes the INSTITUTIONAL site owns. academia serves none of them; each is a
 * confirmed 404 on this host (verified against the deployed staging build, and
 * against apps/www/src/app's real route tree — /nosotros, for instance, is NOT
 * here because www does not serve it either).
 */
const WWW_OWNED = ['/', '/#servicios', '/#equipo', '/proyectos', '/blog', '/contacto'];

/** Routes THIS app serves. These must stay relative — see the inverse guard. */
const ACADEMIA_OWNED = ['/cursos', '/empresa', '/api/lms/asset'];

describe('no relative link points at a route www owns', () => {
  /**
   * Matches a relative href to one of www's routes, and ONLY those: `href="/"`
   * must match while `href="/cursos"` must not, so each alternative is anchored
   * at its closing quote or brace rather than left as a prefix.
   */
  const offenders = () => {
    const hits: string[] = [];
    for (const f of FILES) {
      const src = code(fs.readFileSync(f, 'utf8'));
      for (const route of WWW_OWNED) {
        const esc = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // href="/x"  href={"/x"}  href={'/x'}  href={`/x`}
        const re = new RegExp(
          String.raw`href=(?:"` + esc + String.raw`"|\{\s*["'\`]` + esc + String.raw`["'\`]\s*\})`,
          'g'
        );
        const n = (src.match(re) || []).length;
        if (n > 0) hits.push(`${rel(f)} → href "${route}" x${n}`);
      }
    }
    return hits;
  };

  it('finds none anywhere under src/', () => {
    expect(offenders()).toEqual([]);
  });

  it('still scanned a meaningful number of files (guards against a broken walk)', () => {
    // An empty or tiny FILES list would make the assertion above pass
    // vacuously — the same trap that made an env-var exclusion check worthless
    // against empty CLI output during the staging build-out.
    expect(FILES.length).toBeGreaterThan(50);
    expect(FILES.some((f) => rel(f).includes('components/public/Navbar'))).toBe(true);
    expect(FILES.some((f) => rel(f).includes('components/public/Footer'))).toBe(true);
    expect(FILES.some((f) => rel(f).endsWith('app/(public)/not-found.tsx'))).toBe(true);
  });
});

describe("academia's own routes stay relative (same-origin premise)", () => {
  /**
   * The inverse guard. Absolutising the player page, the asset-proxy path or the
   * course links would put the SCORM iframe on a different origin from the page
   * that mints the session-learner cookie, and CAMPUS content walks
   * window.parent to find the API. That breaks the load-bearing premise of the
   * whole LMS, and it breaks it silently — the deck renders, progress just never
   * persists.
   */
  it('no absolute URL is built for a route this app serves', () => {
    const hits: string[] = [];
    for (const f of FILES) {
      const src = code(fs.readFileSync(f, 'utf8'));
      for (const route of ACADEMIA_OWNED) {
        const esc = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(String.raw`https?://[^"'\`\s]*` + esc, 'g');
        for (const m of src.match(re) || []) {
          // Placeholder/example hosts in error strings and docs are not links.
          if (/example\.com|ci-build-placeholder|localhost/.test(m)) continue;
          hits.push(`${rel(f)} → ${m}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});

describe('the institutional link sets are absolute and single-origin', () => {
  const ORIGIN = 'https://www-test.zephyraconsultora.com';
  let mod: typeof import('@/lib/institutional-links');

  beforeAll(async () => {
    // requireOrigin resolves at MODULE scope and throws when unset, so the value
    // has to exist before the first import.
    process.env.NEXT_PUBLIC_WWW_URL = ORIGIN;
    mod = await import('@/lib/institutional-links');
  });

  it('every navbar and footer href is absolute and on the www origin', () => {
    const all = [...mod.INSTITUTIONAL_NAV_LINKS, ...mod.INSTITUTIONAL_FOOTER_LINKS];
    expect(all.length).toBeGreaterThan(0);
    for (const { href, label } of all) {
      expect(href, `${label} must be absolute`).toMatch(/^https?:\/\//);
      expect(href, `${label} must point at the www origin`).toContain(ORIGIN);
    }
  });

  it('preserves the pre-split labels and order exactly', () => {
    // Renaming or reordering these is an information-architecture decision and
    // is RESERVED. Pinning them here makes an accidental drift fail loudly and
    // an intentional change a deliberate edit to this list.
    expect(mod.INSTITUTIONAL_NAV_LINKS.map((l) => l.label)).toEqual([
      'Inicio',
      'Servicios',
      'Equipo',
      'Proyectos',
      'Perspectivas',
      'Contacto',
    ]);
    // The footer omitted "Equipo" pre-split. Harmonising it would be an IA
    // change, so the difference is asserted rather than smoothed over.
    expect(mod.INSTITUTIONAL_FOOTER_LINKS.map((l) => l.label)).toEqual([
      'Inicio',
      'Servicios',
      'Proyectos',
      'Perspectivas',
      'Contacto',
    ]);
  });

  it('builds no double slash, for the root or for any other path', () => {
    expect(mod.INSTITUTIONAL_HOME).toBe(`${ORIGIN}/`);
    // normalizeOrigin strips the trailing slash from the variable, so a value
    // supplied WITH one must not double up against the paths appended here.
    const all = [...mod.INSTITUTIONAL_NAV_LINKS, ...mod.INSTITUTIONAL_FOOTER_LINKS];
    for (const { href, label } of all) {
      // Ignore the "//" in the scheme; only the path portion matters.
      const afterScheme = href.slice(href.indexOf('://') + 3);
      expect(afterScheme, `${label} → ${href}`).not.toContain('//');
    }
  });

  it('rejects a path that is not rooted', () => {
    expect(() => mod.institutionalHref('proyectos')).toThrow(/rooted path/);
  });
});

describe('both 404 boundaries exist and share one branded panel', () => {
  /**
   * The app-wide fallback is easy to delete by accident and impossible to miss
   * the consequence of: without app/not-found.tsx, every unmatched path serves
   * Next's built-in "This page could not be found." — English copy on a lang="es"
   * document, unbranded, with no link out. That is what /proyectos, /blog,
   * /contacto and / actually returned on the deployed staging build.
   */
  it('the app-wide fallback boundary exists', () => {
    expect(fs.existsSync(path.join(SRC, 'app/not-found.tsx'))).toBe(true);
  });

  it('the (public) segment boundary still exists (it is the one with the navbar)', () => {
    expect(fs.existsSync(path.join(SRC, 'app/(public)/not-found.tsx'))).toBe(true);
  });

  it('both boundaries render the shared panel rather than their own markup', () => {
    for (const p of ['app/not-found.tsx', 'app/(public)/not-found.tsx']) {
      const src = code(fs.readFileSync(path.join(SRC, p), 'utf8'));
      expect(src, p).toContain('@/components/public/NotFound');
      // Duplicated markup is how the two drift: one gets fixed, the other does
      // not, and only one of them is reachable in any given test.
      expect(src, p).not.toMatch(/<h1|className=\{styles\./);
    }
  });

  it('the panel offers an absolute way out', () => {
    const src = code(
      fs.readFileSync(path.join(SRC, 'components/public/NotFound/NotFound.tsx'), 'utf8')
    );
    expect(src).toContain('INSTITUTIONAL_HOME');
    // A relative href here is the dead-end-from-a-dead-end case.
    expect(src).not.toMatch(/href="\/"/);
  });
});

describe('the components consume the shared list', () => {
  /**
   * Without this, a future edit could reintroduce a LOCAL literal array in the
   * component — the absence guard above would still pass if the new literals
   * happened to be absolute, while quietly forking the link set into two places.
   */
  const readSrc = (p: string) => code(fs.readFileSync(path.join(SRC, p), 'utf8'));

  it('Navbar and Footer import from @/lib/institutional-links', () => {
    for (const p of [
      'components/public/Navbar/Navbar.tsx',
      'components/public/Footer/Footer.tsx',
    ]) {
      expect(readSrc(p), p).toContain('@/lib/institutional-links');
    }
  });

  it('neither component defines its own href literal array', () => {
    for (const p of [
      'components/public/Navbar/Navbar.tsx',
      'components/public/Footer/Footer.tsx',
    ]) {
      // A local array of {href: "...", label: "..."} objects is the shape that
      // regressed. Social links are absolute externals and are not this shape.
      expect(readSrc(p), p).not.toMatch(/\{\s*href:\s*["'`]\//);
    }
  });
});
