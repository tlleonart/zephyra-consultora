/**
 * config.matcher — the gate that decides whether the learner middleware runs.
 *
 * WHY THIS FILE EXISTS SEPARATELY FROM middleware.test.ts.
 *
 * Every test that calls `middleware(request)` directly BYPASSES `config.matcher`.
 * Next.js only invokes the middleware for paths the matcher selects, so a broken
 * matcher makes the entire learner gate inert while every behavioural assertion
 * still passes — a security guard that dies green.
 *
 * That is not hypothetical. T-fe-009 found apps/backoffice's matcher literal
 * written `'.*\.*'` where it needed `'.*\\..*'`: in a single-quoted JS string
 * `\.` collapses to `.`, so the "path contains a dot => static asset" exclusion
 * became `.*..*`, matching ANY non-empty path; the negative lookahead then
 * rejected every route. The compiled regexp in
 * .next/server/middleware-manifest.json confirmed /admin, /login and the rest all
 * failed to match — the admin gate never ran in a real build. Sixteen green
 * behavioural assertions coexisted with a dead matcher for as long as it existed.
 *
 * THIS app's matcher is correct and has been since it was introduced (two
 * backslashes, verified). It simply had no test, so the identical one-character
 * regression could land here silently. This suite closes that.
 *
 * PROPORTION, deliberately not overstated: academia's protected route is also
 * covered page-side — the player page calls getLearnerSession() and checks
 * enrollment — so a dead matcher here would be a loss of defense-in-depth, not an
 * open door. Same as backoffice was.
 */
import { describe, it, expect } from 'vitest';
import { config } from '../../src/middleware';

// Next.js compiles config.matcher through path-to-regexp. The escaping bug this
// guards against happens EARLIER, at JS string level, so testing the literal as a
// regexp source reproduces it faithfully. (Verified for backoffice against the
// real compiled regexp in .next/server/middleware-manifest.json at T-fe-009.)
const matcherRegexes = config.matcher.map((m) => new RegExp(`^${m}$`));
const matches = (path: string): boolean =>
  matcherRegexes.some((re) => re.test(path));

describe('config.matcher — the gate that decides whether the learner branch runs', () => {
  it('selects the learner-protected player routes', () => {
    for (const path of [
      '/cursos/dei/player',
      '/cursos/sostenibilidad-101/player',
      '/cursos/dei/player/scorm-frame',
    ]) {
      expect(matches(path), `${path} must reach the middleware`).toBe(true);
    }
  });

  it('selects the public catalog and the learner auth routes', () => {
    // These are NOT gated by the branch, but they must still REACH the
    // middleware: the signed-in-learner redirect away from /cursos/auth/* is
    // implemented there, and it cannot fire on a path the matcher drops.
    for (const path of [
      '/cursos',
      '/cursos/dei',
      '/cursos/auth/signin',
      '/cursos/auth/verify',
    ]) {
      expect(matches(path), `${path} must reach the middleware`).toBe(true);
    }
  });

  it('selects the empresa (B2B) routes', () => {
    for (const path of [
      '/empresa',
      '/empresa/registro/crear',
      '/empresa/invitacion',
      '/empresa/compra/exito',
    ]) {
      expect(matches(path), `${path} must reach the middleware`).toBe(true);
    }
  });

  it('excludes api, _next internals and dotted static assets', () => {
    for (const path of [
      // /api/lms/asset/[slug]/[...path] is the same-origin SCORM proxy (ADR
      // 0005). The CAMPUS iframe fetches assets through it, so it must NOT be
      // intercepted — any auth gate on the proxy lives in the route handler.
      '/api/lms/asset/dei/index.html',
      '/api/anything',
      '/_next/static/chunk.js',
      '/_next/image',
      '/favicon.ico',
      '/logo.png',
    ]) {
      expect(matches(path), `${path} must NOT reach the middleware`).toBe(false);
    }
  });

  it('would REJECT the single-backslash regression (this suite is not vacuous)', () => {
    // The exact defect from apps/backoffice, reproduced here as a literal: one
    // backslash instead of two. In a single-quoted JS string `\.` collapses to
    // `.`, so `.*\..*` becomes `.*..*` — which matches any non-empty path, making
    // the negative lookahead reject EVERYTHING.
    //
    // This is what proves the four assertions above have teeth. Without it, they
    // are four tests that pass against a matcher nobody has verified can fail.
    // Derived from the shipped value by string surgery rather than written out as
    // a source literal, so no backslash appears in this file (a bare `\.` is what
    // eslint's no-useless-escape flags, and disabling that rule inside the test
    // that exists BECAUSE of the escape would be its own small irony).
    //
    // Mind the two levels. src/middleware.ts SOURCE says `.*\\..*`; the resulting
    // string VALUE is `.*\..*` — one backslash, which as a regexp means a literal
    // dot. The defect is a source written `.*\..*`, whose value is `.*..*` — the
    // backslash is GONE, and `.` then matches any character. So reproducing it at
    // runtime means DELETING the backslash from the value, not halving it.
    const BACKSLASH = String.fromCharCode(92);
    const brokenSource = config.matcher[0].split(BACKSLASH).join('');
    // Sanity: the surgery changed something, i.e. the shipped value really does
    // carry the escape that makes the dot literal.
    expect(brokenSource).not.toBe(config.matcher[0]);
    const broken = new RegExp(`^${brokenSource}$`);
    expect(broken.test('/cursos/dei/player')).toBe(false);
    expect(broken.test('/cursos')).toBe(false);
    expect(broken.test('/empresa')).toBe(false);

    // And the shipped literal does the opposite on the same inputs — i.e. the
    // difference between the two is exactly the bug.
    expect(matches('/cursos/dei/player')).toBe(true);
    expect(matches('/cursos')).toBe(true);
    expect(matches('/empresa')).toBe(true);
  });

  it('ships exactly one matcher entry, and it carries two backslashes', () => {
    // A second entry would need its own coverage above; a single backslash is the
    // regression. Asserting the literal keeps both visible to review.
    expect(config.matcher).toHaveLength(1);
    expect(config.matcher[0]).toContain('.*\\..*');
    expect(config.matcher[0]).toBe(
      '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'
    );
  });
});
