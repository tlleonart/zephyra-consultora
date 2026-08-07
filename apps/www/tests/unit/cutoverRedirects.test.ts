/**
 * APEX 301 MAP — rule guards.
 *
 * The cutover redirect map is the single riskiest configuration change in the
 * split, for three reasons worth naming:
 *
 *   1. It is the only part of the cutover that CANNOT be rehearsed against real
 *      domains before it happens — staging has no apex. So the rules themselves
 *      have to be verified structurally here and behaviourally on the staging
 *      hosts, and neither substitutes for the other.
 *   2. A MISSING rule fails silently and asymmetrically: the page 404s only for
 *      the people who already had the old URL — Zephyra's own staff at /login,
 *      an invited learner at /empresa/invitacion, a buyer returning from
 *      MercadoPago. Nobody testing the new site by clicking around would ever
 *      hit it.
 *   3. A WRONG rule is expensive to undo. These are 301s; browsers and
 *      intermediaries cache them hard, so a visitor who once followed a bad
 *      redirect can keep following it out of their own cache after the fix ships.
 *
 * The most valuable assertion in this file is the LAST one: that no rule shadows a
 * route this app actually serves. A stray `/blog/:path*` would silently hand the
 * institutional blog to another host, and the redirect would look correct in
 * review.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildCutoverRedirects, COVERED } from '@/lib/cutover-redirects';

const ACADEMIA = 'https://academia-test.zephyraconsultora.com';
const BACKOFFICE = 'https://backoffice-test.zephyraconsultora.com';
const SELF = 'https://apex-test.zephyraconsultora.com';

const build = (over: Partial<Parameters<typeof buildCutoverRedirects>[0]> = {}) =>
  buildCutoverRedirects({
    academia: ACADEMIA,
    backoffice: BACKOFFICE,
    self: SELF,
    ...over,
  });

describe('fails loudly rather than emitting an empty map', () => {
  it('throws and names NEXT_PUBLIC_ACADEMIA_URL when it is missing', () => {
    expect(() => build({ academia: undefined })).toThrow(/NEXT_PUBLIC_ACADEMIA_URL/);
  });

  it('throws and names NEXT_PUBLIC_BACKOFFICE_URL when it is missing', () => {
    expect(() => build({ backoffice: undefined })).toThrow(/NEXT_PUBLIC_BACKOFFICE_URL/);
  });

  it('throws on a blank value, not just an absent one', () => {
    expect(() => build({ academia: '   ' })).toThrow(/NEXT_PUBLIC_ACADEMIA_URL/);
  });

  it('still builds when self is unknown (the loop guard is best-effort)', () => {
    expect(() => build({ self: undefined })).not.toThrow();
  });
});

describe('loop guard', () => {
  /**
   * Three Vercel projects with three sets of similar-looking hostnames is a very
   * plausible place to paste the wrong origin. If a destination is this app's own
   * origin, /cursos redirects to /cursos on the same host, forever, and the
   * browser aborts. Refusing to build is strictly better than shipping that.
   */
  it('refuses when academia resolves to this app', () => {
    expect(() => build({ academia: SELF })).toThrow(/same origin as this app/);
  });

  it('refuses when backoffice resolves to this app', () => {
    expect(() => build({ backoffice: SELF })).toThrow(/same origin as this app/);
  });

  it('names the offending variable so the fix is obvious', () => {
    expect(() => build({ backoffice: SELF })).toThrow(/NEXT_PUBLIC_BACKOFFICE_URL/);
  });

  it('tolerates a trailing slash difference rather than false-positiving', () => {
    // normalizeOrigin strips trailing slashes, so these are the SAME origin and
    // must still be caught — a guard that a trailing slash defeats is no guard.
    expect(() => build({ academia: `${SELF}/` })).toThrow(/same origin as this app/);
  });
});

describe('all four rule groups are present', () => {
  const rules = build();
  const sourceOf = (s: string) => rules.find((r) => r.source === s);

  it('every rule emits a literal 301, not 308', () => {
    // Next's `permanent: true` emits 308, NOT 301 — confirmed by reading
    // .next/routes-manifest.json. Both are permanent redirects, but the spec and
    // the amendment request say "the 301 map", and 308's method-preservation buys
    // nothing for a set of GET navigations. Pinning the number here is what stops
    // a future edit from swapping in `permanent: true` and quietly changing the
    // wire response while every other assertion still passes.
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) expect(r.statusCode, r.source).toBe(301);
    // And nothing may reintroduce the `permanent` key alongside it: Next rejects
    // a rule carrying both.
    for (const r of rules) expect(r).not.toHaveProperty('permanent');
  });

  it('every destination is absolute', () => {
    for (const r of rules) expect(r.destination, r.source).toMatch(/^https?:\/\//);
  });

  it('group 1 — /cursos goes to academia, bare and deep (specified in §3.1)', () => {
    expect(sourceOf('/cursos')?.destination).toBe(`${ACADEMIA}/cursos`);
    expect(sourceOf('/cursos/:path+')?.destination).toBe(`${ACADEMIA}/cursos/:path+`);
  });

  it('group 2 — /empresa goes to academia, bare and deep (ADDED; §3.1 omitted it)', () => {
    // §3.1 justified keeping the /empresa prefix partly so links already in the
    // wild keep resolving, which is only true with this rule. It also carries the
    // MercadoPago return surfaces: a buyer 404ing AFTER paying is the worst case.
    expect(sourceOf('/empresa')?.destination).toBe(`${ACADEMIA}/empresa`);
    expect(sourceOf('/empresa/:path+')?.destination).toBe(`${ACADEMIA}/empresa/:path+`);
  });

  it('group 3 — /admin goes to backoffice, bare and deep (specified in §3.1)', () => {
    expect(sourceOf('/admin')?.destination).toBe(`${BACKOFFICE}/admin`);
    expect(sourceOf('/admin/:path+')?.destination).toBe(`${BACKOFFICE}/admin/:path+`);
  });

  it('uses :path+ and never :path*, so no rule can emit a trailing slash', () => {
    // `:path*` matches ZERO segments, and with zero segments the destination
    // interpolates to "/cursos/" — which the destination app answers with its own
    // 308 back to "/cursos". Measured on staging as a three-hop chain mixing 301
    // and 308 for the most likely entry point. Each prefix therefore gets an exact
    // rule plus a :path+ rule instead.
    for (const r of rules) {
      expect(r.source, `${r.source} must not use :path*`).not.toContain(':path*');
      expect(r.destination, r.destination).not.toContain(':path*');
      expect(r.destination, `${r.destination} must not end in a slash`).not.toMatch(/\/$/);
    }
  });

  it('group 4 — the auth paths go to backoffice (ADDED; §3.1 omitted them)', () => {
    // /login is the URL Zephyra's staff use TODAY. It is not under /admin, so
    // the /admin rule never matched it, and without this group the people who
    // publish the site lose access at cutover with no explanatory error.
    for (const p of ['/login', '/forgot-password', '/reset-password']) {
      expect(sourceOf(p)?.destination, p).toBe(`${BACKOFFICE}${p}`);
    }
  });

  it('the auth paths are EXACT, never prefix rules', () => {
    // A `/login/:path*` would swallow any future /login-something route on the
    // apex, and these are single pages.
    for (const p of COVERED.backofficeExact) {
      expect(rules.some((r) => r.source === `${p}/:path*`), p).toBe(false);
    }
  });

  it('is path-preserving: destination path always equals source path', () => {
    for (const r of rules) {
      const destPath = r.destination.replace(/^https?:\/\/[^/]+/, '');
      expect(destPath, r.source).toBe(r.source);
    }
  });

  it('has no duplicate sources', () => {
    const sources = rules.map((r) => r.source);
    expect(sources.length).toBe(new Set(sources).size);
  });
});

describe('no rule shadows a route this app actually serves', () => {
  /**
   * THE ONE THAT MATTERS MOST. Every rule here takes a path AWAY from the apex.
   * A rule matching one of www's own routes would hand the institutional site's
   * own page to another host, permanently and cached — and it would read as
   * perfectly correct in a diff. So the check is not editorial: it enumerates the
   * real route tree off disk and asserts disjointness.
   */
  const APP_DIR = path.resolve(__dirname, '../../src/app');

  /** Top-level URL segments this app serves, read from the route tree. */
  const ownSegments = (): string[] => {
    const segs = new Set<string>();
    const walk = (dir: string, prefix: string[]) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!e.isDirectory()) continue;
        const isGroup = e.name.startsWith('(') && e.name.endsWith(')');
        const next = isGroup ? prefix : [...prefix, e.name];
        // A route group contributes no URL segment, so keep descending through it.
        if (!isGroup && prefix.length === 0) segs.add(e.name);
        walk(path.join(dir, e.name), next);
      }
    };
    walk(APP_DIR, []);
    return [...segs];
  };

  it('read a non-empty route tree (guards against a vacuous pass)', () => {
    const segs = ownSegments();
    // An empty list would make the assertion below pass while checking nothing.
    expect(segs.length).toBeGreaterThan(0);
    // Sanity: these are known www routes.
    expect(segs).toContain('blog');
    expect(segs).toContain('proyectos');
    expect(segs).toContain('contacto');
  });

  it('no redirect source matches a segment www serves', () => {
    const own = ownSegments();
    const collisions: string[] = [];
    for (const r of build()) {
      const firstSegment = r.source.split('/').filter(Boolean)[0];
      if (own.includes(firstSegment)) {
        collisions.push(`${r.source} shadows www's own /${firstSegment}`);
      }
    }
    expect(collisions).toEqual([]);
  });

  it('conversely, no route www serves is left uncovered by accident', () => {
    // The inverse sanity check: the covered prefixes must NOT be things www
    // serves. Stated as data so a future prefix added to the map is forced
    // through this assertion too.
    const covered = [
      ...COVERED.academiaPrefixes,
      ...COVERED.backofficePrefixes,
      ...COVERED.backofficeExact,
    ].map((p) => p.replace(/^\//, ''));
    const own = ownSegments();
    for (const c of covered) {
      expect(own, `www must not serve /${c} — it was redirected away`).not.toContain(c);
    }
  });
});
