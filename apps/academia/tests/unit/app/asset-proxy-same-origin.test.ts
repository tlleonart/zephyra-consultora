/**
 * SAME-ORIGIN GUARD (premise 1 of the platform split) — static assertions.
 *
 * The SCORM player page, the asset proxy route and the `session-learner` cookie
 * MUST live on the SAME HOST. CAMPUS content discovers the LMS API by walking
 * `window.parent` and additionally calls
 * `window.parent.document.querySelectorAll('iframe')`. Serve the SCO assets
 * from `*.convex.cloud` — or from any origin other than the page's — and the
 * browser blocks BOTH accesses. The failure is SILENT: the content still
 * renders inside the iframe, and progress simply stops persisting. No console
 * error on the page, no failed request, no red test. That is why this file
 * exists as a checked-in guard rather than as a code comment.
 *
 * These are deliberately STATIC assertions on resolved paths and on source
 * text, not an e2e test:
 *   - they need no browser, no Convex deployment and no SCORM package, so they
 *     run in the `test` CI job on every push (an e2e guard would need the
 *     Playwright job this repo does not have yet — see ci.yml's closing note);
 *   - the property being guarded is structural (WHICH APP owns the route, and
 *     whether the iframe src is relative), and structure is exactly what a
 *     static check can prove.
 *
 * Companion guard, in the other direction: ci.yml's `build` job greps
 * apps/academia/.next/routes-manifest.json for the proxy route, which proves the
 * route not only exists in source but survives compilation into THIS app's
 * manifest. Both are needed — this file catches a move, that one catches a
 * route that exists but does not build.
 *
 * If a future refactor genuinely needs the proxy elsewhere, it must first
 * disprove the same-origin premise with evidence (a working player served
 * cross-origin). Making this file green by deleting or relaxing it is a
 * sprint-level regression.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// tests/unit/app -> repo-relative app root
const APP_ROOT = path.resolve(__dirname, "../../..");
const APP_ROOT_BASENAME = path.basename(APP_ROOT);

const PROXY_ROUTE_REL = path.join(
  "src",
  "app",
  "api",
  "lms",
  "asset",
  "[slug]",
  "[...path]",
  "route.ts"
);
const PROXY_ROUTE_ABS = path.join(APP_ROOT, PROXY_ROUTE_REL);

const PLAYER_REL = path.join(
  "src",
  "app",
  "(public)",
  "cursos",
  "[slug]",
  "player",
  "ScormPlayer.tsx"
);
const PLAYER_ABS = path.join(APP_ROOT, PLAYER_REL);

describe("SCORM same-origin premise — the asset proxy belongs to apps/academia", () => {
  it("resolves this test file's own app root to apps/academia", () => {
    // Anchors every assertion below: they are relative to the app that owns
    // this test, so moving the route to a sibling app makes them fail.
    expect(APP_ROOT_BASENAME).toBe("academia");
  });

  it("the proxy route handler exists inside THIS app", () => {
    expect(
      fs.existsSync(PROXY_ROUTE_ABS),
      `Expected the SCORM asset proxy at apps/academia/${PROXY_ROUTE_REL}. ` +
        `If it moved to another app, the player iframe becomes CROSS-ORIGIN and ` +
        `the window.parent.API bridge dies SILENTLY (see this file's docblock).`
    ).toBe(true);
  });

  it("the player page exists inside THIS app, i.e. proxy and player share a host", () => {
    expect(
      fs.existsSync(PLAYER_ABS),
      `Expected the SCORM player at apps/academia/${PLAYER_REL}. Player and ` +
        `proxy must be in the SAME app — that is what makes them same-origin.`
    ).toBe(true);
  });

  it("the player builds a RELATIVE asset URL (no origin, no *.convex.cloud)", () => {
    const src = fs.readFileSync(PLAYER_ABS, "utf8");

    // The iframe src must start at "/" so the browser resolves it against the
    // page's own origin, whatever host academia is deployed on.
    expect(src).toMatch(/`\/api\/lms\/asset\/\$\{/);

    // No absolute origin anywhere near the asset URL construction.
    const assetUrlLines = src
      .split("\n")
      .filter(line => line.includes("/api/lms/asset/"));
    expect(assetUrlLines.length).toBeGreaterThan(0);
    for (const line of assetUrlLines) {
      expect(line).not.toMatch(/https?:\/\//);
      expect(line).not.toMatch(/convex\.cloud/);
      expect(line).not.toMatch(/NEXT_PUBLIC_CONVEX_URL/);
      expect(line).not.toMatch(/NEXT_PUBLIC_APP_URL/);
      expect(line).not.toMatch(/NEXT_PUBLIC_SITE_URL/);
    }
  });

  it("the SCO iframe keeps sandbox='allow-scripts allow-same-origin'", () => {
    const src = fs.readFileSync(PLAYER_ABS, "utf8");
    // Dropping allow-same-origin makes the iframe an opaque origin, which
    // breaks window.parent access even though the URL is same-origin.
    expect(src).toContain('sandbox="allow-scripts allow-same-origin"');
  });
});
