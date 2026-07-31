/**
 * V28 — cross-host links out of the staff console (M4).
 *
 * Two call sites pushed the RELATIVE path `/cursos/<slug>/player` from
 * backoffice.*, which post-split resolves against the wrong host and 404s. These
 * were found by accident during T-fe-009, not by search, which is the reason the
 * second half of this suite exists: a behavioural test can only cover the two
 * links that exist today, so a source invariant guards the ones nobody has
 * written yet.
 *
 * A relative link is not a hardcoded URL — it is a MISSING one, and no grep for a
 * hostname will ever find it.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { academiaPlayerUrl } from '@/features/lms/lib/academia-links';

/** Production origin of apps/academia (boundaries v1.1 §3.1). */
const ACADEMIA = 'https://academia.zephyraconsultora.com';
const BACKOFFICE = 'https://backoffice.zephyraconsultora.com';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, NEXT_PUBLIC_ACADEMIA_URL: ACADEMIA };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('academiaPlayerUrl — absolute, on academia, path unchanged', () => {
  it('builds the player URL on the academia origin', () => {
    expect(academiaPlayerUrl('sostenibilidad-101')).toBe(
      `${ACADEMIA}/cursos/sostenibilidad-101/player`
    );
  });

  it('is ABSOLUTE — the V28 regression is a URL with no origin', () => {
    const url = academiaPlayerUrl('dei');
    expect(url.startsWith('/')).toBe(false);
    expect(new URL(url).origin).toBe(ACADEMIA);
    // Specifically not this host: that is the 404 being fixed.
    expect(new URL(url).origin).not.toBe(BACKOFFICE);
  });

  it('keeps the /cursos prefix and the /player suffix verbatim (boundaries §3.1 D1)', () => {
    expect(new URL(academiaPlayerUrl('dei')).pathname).toBe(
      '/cursos/dei/player'
    );
  });

  it('does not read this app\'s own origin variable by mistake', () => {
    // The subtle wrong fix: reaching for NEXT_PUBLIC_APP_URL (which is
    // backoffice.*) because it happens to be defined. That would produce a URL
    // that looks absolute, passes review, and still 404s.
    process.env.NEXT_PUBLIC_APP_URL = BACKOFFICE;
    delete process.env.NEXT_PUBLIC_ACADEMIA_URL;
    expect(() => academiaPlayerUrl('dei')).toThrow(
      /NEXT_PUBLIC_ACADEMIA_URL/
    );
  });

  it('throws rather than emitting a relative path when the origin is unset', () => {
    delete process.env.NEXT_PUBLIC_ACADEMIA_URL;
    expect(() => academiaPlayerUrl('dei')).toThrow();
  });

  it('percent-encodes the slug', () => {
    expect(academiaPlayerUrl('a b')).toBe(`${ACADEMIA}/cursos/a%20b/player`);
  });
});

describe('no cross-host RELATIVE link remains anywhere in this app', () => {
  const SRC = path.resolve(__dirname, '../../../../src');

  const sourceFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) return sourceFiles(full);
      return /\.tsx?$/.test(entry) ? [full] : [];
    });

  const files = sourceFiles(SRC);

  it('collected this app\'s source files (harness positive control)', () => {
    // Without this, a misresolved SRC would make the assertion below pass
    // vacuously — the same shape as the dead matcher that survived review.
    expect(files.length).toBeGreaterThan(10);
    expect(
      files.some((f) => f.endsWith(path.join('lms', 'LmsCourseList.tsx')))
    ).toBe(true);
    expect(
      files.some((f) => f.endsWith(path.join('new', 'ScormUploadForm.tsx')))
    ).toBe(true);
  });

  // ONE regex, used by both the scan and its control below, so the two cannot
  // drift. The `[=({\s]*` run is load-bearing: the V28 literal was
  // href={`/cursos/...`}, and the first draft of this pattern allowed only `=`
  // or `(` before the quote — it did NOT match a JSX brace, so it would have
  // reported the very bug it was written for as absent. The control below caught
  // that before this suite was committed.
  const RELATIVE_CROSS_HOST =
    /(?:href|router\.(?:push|replace)|location\.(?:assign|replace)|location\.href)\s*[=({\s]*[`'"]\/(?:cursos|empresa)\b/;

  it('routes no href / router.push / location.assign at a relative /cursos or /empresa path', () => {
    // /cursos and /empresa are ACADEMIA's namespaces (boundaries §3, §3.1). This
    // app serves neither, so a relative link to them is always a 404.
    const offenders = files.filter((f) =>
      RELATIVE_CROSS_HOST.test(readFileSync(f, 'utf8'))
    );
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it('matches the exact literals V28 found (the scan is not vacuous)', () => {
    // The first two are verbatim from the pre-M4 source of the two fixed files.
    expect(
      RELATIVE_CROSS_HOST.test('<Link href={`/cursos/${c.slug}/player`}>')
    ).toBe(true);
    expect(
      RELATIVE_CROSS_HOST.test('router.push(`/cursos/${result.slug}/player`)')
    ).toBe(true);
    expect(RELATIVE_CROSS_HOST.test('href="/empresa/invitacion"')).toBe(true);
    expect(
      RELATIVE_CROSS_HOST.test("window.location.assign('/empresa/compra/exito')")
    ).toBe(true);
    // And does not fire on the fixed form, nor on this app's own routes.
    expect(RELATIVE_CROSS_HOST.test('href={academiaPlayerUrl(c.slug)}')).toBe(
      false
    );
    expect(
      RELATIVE_CROSS_HOST.test('<Link href={`/admin/lms/courses/x/edit`}>')
    ).toBe(false);
    expect(
      RELATIVE_CROSS_HOST.test('href={`${ACADEMIA}/cursos/x/player`}')
    ).toBe(false);
  });
});
