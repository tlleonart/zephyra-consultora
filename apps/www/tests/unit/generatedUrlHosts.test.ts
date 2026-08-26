/**
 * M4 — boundaries v1.1 §5, row 1. The www-owned row.
 *
 *   §5 row 1  Contact form notification  www  ->  (internal to Zephyra's inbox)
 *
 * www is the only app whose row targets no app host: its single outbound email is
 * addressed to Zephyra's own inbox and carries no link back into any app. The
 * assertion therefore has two halves, and the SECOND is the one with teeth:
 *
 *   1. the notification still goes to the internal inbox, and
 *   2. this app generates NO app URL at all — so the M4 sweep cannot be quietly
 *      undone here by someone adding an apex-hardcoded "volver al sitio" link, or
 *      a cross-host link to academia/backoffice without an explicit origin var.
 *
 * Half 2 is a source-level invariant. That is deliberate: a behavioural test can
 * only cover the code paths that exist today, and the failure mode being guarded
 * against is a NEW line in a file this suite has never heard of. The precedent
 * for reading source in a test is apps/academia's asset-proxy-same-origin suite.
 *
 * UPDATED at C-03 (M-FIX): "generates NO app URL at all" is narrowed to "no
 * CROSS-HOST app URL" — see the ORIGIN_VAR_ALLOWLIST block below for why
 * lib/site.ts is now a second, deliberate exception (Open Graph metadata needs
 * this app's own absolute origin) and why it cannot smuggle a foreign host back
 * in the way the guarded-against regression would.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "../../src");

/** Every .ts/.tsx file under apps/www/src. */
const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });

const files = sourceFiles(SRC);
const read = (f: string): string => readFileSync(f, "utf8");

describe("boundaries §5 row 1 — the contact notification stays internal", () => {
  it("addresses the notification to Zephyra's own inbox", () => {
    const route = read(path.join(SRC, "app/api/send-mail/route.ts"));
    expect(route).toContain('const to = "info@zephyraconsultora.com"');
  });

  it("puts no link to any app in the notification body", () => {
    const route = read(path.join(SRC, "app/api/send-mail/route.ts"));
    // The body is `text`, built from the submitter's name/email/content only.
    expect(route).not.toMatch(/https?:\/\/[^"'\s]*zephyraconsultora\.com/);
  });
});

describe("www generates no app URL (the M4 sweep, pinned)", () => {
  it("collected a non-trivial number of source files (harness positive control)", () => {
    // Without this, an empty/misresolved `files` array would make every
    // assertion below pass vacuously — the exact shape of a gate that dies green.
    expect(files.length).toBeGreaterThan(10);
    expect(files.some((f) => f.endsWith(path.join("send-mail", "route.ts")))).toBe(
      true
    );
  });

  it("hardcodes no absolute zephyraconsultora.com URL anywhere", () => {
    const offenders = files.filter((f) =>
      /https?:\/\/[^"'\s]*zephyraconsultora\.com/.test(read(f))
    );
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  /**
   * The files allowed to read an app-origin variable, and why each is here.
   *
   * This test previously asserted a flat zero and its comment named the exact
   * procedure for the day that stopped being true: "add
   * NEXT_PUBLIC_ACADEMIA_URL / NEXT_PUBLIC_BACKOFFICE_URL, read it through
   * requireOrigin(), and update boundaries §5 and this list in the same change."
   * That day came twice, for two different reasons:
   *
   *   lib/cutover-redirects.ts  the apex 301 map (M4). Consumes ACADEMIA_URL +
   *                             BACKOFFICE_URL + APP_URL as BUILD CONFIGURATION —
   *                             next.config.ts calls it to emit the redirect
   *                             list, and nothing at request time reads them.
   *   lib/site.ts               C-03 (M-FIX). `grep openGraph apps/www/src` had
   *                             returned zero files: no page declared any Open
   *                             Graph fields, so sharing a link to this site
   *                             showed a title and no image on every platform
   *                             that renders link previews. Fixing it needs an
   *                             ABSOLUTE origin for the OG `url` and `images`
   *                             fields — a relative URL there resolves against
   *                             nothing in most scrapers. This is exactly the
   *                             "SEO canonical" use requireOrigin's own docstring
   *                             names, and it only ever resolves THIS APP'S OWN
   *                             origin — never a cross-host link.
   *
   * The §5 row-1 claim stays NARROWED, not withdrawn: no PAGE, COMPONENT or EMAIL
   * reads a raw NEXT_PUBLIC_*_URL var directly (both files below resolve it once,
   * through requireOrigin, and everything else imports the resolved constant) —
   * see the request-time assertion further down for the half of the claim that
   * still has teeth: no file anywhere in this app ever points a URL at another
   * app's origin.
   *
   * Kept as an explicit allowlist rather than a relaxed regex on purpose: a
   * broadened pattern would silently permit the next component that hardcodes a
   * cross-host link, which is the failure this suite exists to catch.
   */
  const ORIGIN_VAR_ALLOWLIST = ["lib/cutover-redirects.ts", "lib/site.ts"];

  it("reads no app-origin env var outside the allowlisted resolution points", () => {
    const offenders = files
      .filter((f) => /NEXT_PUBLIC_(APP|SITE|ACADEMIA|BACKOFFICE)_URL/.test(read(f)))
      .map((f) => path.relative(SRC, f).replace(/\\/g, "/"))
      .filter((f) => !ORIGIN_VAR_ALLOWLIST.includes(f));
    expect(offenders).toEqual([]);
  });

  it("the allowlisted files exist, resolve through requireOrigin, and stay narrow", () => {
    // Without this, an allowance could outlive the thing it was granted for —
    // the file gets deleted or renamed, the entry stays, and it quietly becomes a
    // licence for some future file that happens to match the same path.
    const relPaths = files.map((f) => path.relative(SRC, f).replace(/\\/g, "/"));
    for (const entry of ORIGIN_VAR_ALLOWLIST) {
      expect(relPaths, entry).toContain(entry);
      // Every entry must resolve the origin through requireOrigin — not off
      // process.env raw with a fallback (the exact regression an apex fallback
      // caused pre-M4: a silent 404 for a real invited user).
      expect(read(path.join(SRC, entry)), entry).toContain("requireOrigin");
    }

    const config = read(path.resolve(SRC, "../next.config.ts"));
    expect(config).toContain("buildCutoverRedirects");
    expect(config).toContain("./src/lib/cutover-redirects");

    // lib/site.ts is the OG/SEO-metadata resolution point specifically — it
    // must resolve its OWN origin (NEXT_PUBLIC_APP_URL) and never a foreign
    // app's, which would smuggle a cross-host link back in through the OG door.
    const site = read(path.join(SRC, "lib/site.ts"));
    expect(site).toContain("NEXT_PUBLIC_APP_URL");
    expect(site).not.toMatch(/NEXT_PUBLIC_(ACADEMIA|BACKOFFICE)_URL/);
  });

  it("still generates no app URL at REQUEST time (the §5 row-1 claim itself)", () => {
    // The narrowing above is scoped to build config. Assert the runtime claim
    // directly so it cannot erode behind the allowlist: no file that ships to a
    // page or an email may read these variables.
    const runtime = files.filter((f) => {
      const r = path.relative(SRC, f).replace(/\\/g, "/");
      return r.startsWith("app/") || r.startsWith("components/");
    });
    expect(runtime.length).toBeGreaterThan(5);
    const offenders = runtime.filter((f) =>
      /NEXT_PUBLIC_(APP|SITE|ACADEMIA|BACKOFFICE)_URL/.test(read(f))
    );
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  // Same regex, and the same warning, as apps/backoffice's V28 suite: the
  // `[=({\s]*` run is what lets this match a JSX brace. A draft allowing only
  // `=`/`(` silently failed to match href={`/cursos/...`} — i.e. it could not see
  // the bug it exists for. The control below is what makes that detectable.
  const RELATIVE_CROSS_HOST =
    /(?:href|router\.(?:push|replace)|location\.(?:assign|replace)|location\.href)\s*[=({\s]*[`'"]\/(?:cursos|empresa|admin)\b/;

  it("emits no cross-host relative link into another app's route namespace (V28)", () => {
    // The V28 failure shape: a relative link to a prefix this app does not serve.
    // Relative is not "unspecified" — it resolves against THIS host and 404s.
    const offenders = files.filter((f) => RELATIVE_CROSS_HOST.test(read(f)));
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it("matches the V28 literal shapes (the scan is not vacuous)", () => {
    expect(
      RELATIVE_CROSS_HOST.test("<Link href={`/cursos/${c.slug}/player`}>")
    ).toBe(true);
    expect(RELATIVE_CROSS_HOST.test('href="/admin/lms"')).toBe(true);
    expect(
      RELATIVE_CROSS_HOST.test("router.push('/empresa/registro')")
    ).toBe(true);
    // www's own routes and already-absolute links must not trip it.
    expect(RELATIVE_CROSS_HOST.test('href="/contacto"')).toBe(false);
    expect(
      RELATIVE_CROSS_HOST.test('href={`${ACADEMIA}/cursos/x/player`}')
    ).toBe(false);
  });
});
