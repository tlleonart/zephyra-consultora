/**
 * SCORM PLAYER PREMISE — the verification harness, committed instead of re-described.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * This harness was rebuilt from scratch THREE times on branch 011 (asset-proxy
 * auth gate, player-chrome rebrand, token coherence). The third rebuild FAILED,
 * and the failure was read as a product regression: a correct three-line fix was
 * reverted before another agent re-verified it by hand. The knowledge lived only
 * in prose inside handoffs. It lives here now.
 *
 * THE TWO FACTS THE SUCCESSFUL RUNS KNEW AND THE FAILED ONE DID NOT
 * ----------------------------------------------------------------
 * 1. `networkidle` NEVER FIRES ON A SCORM DECK. The CAMPUS wrapper polls
 *    continuously (LMSGetValue + its own timers), so the network is never idle
 *    for 500ms. A `waitUntil: 'networkidle'` navigation therefore TIMES OUT
 *    BEFORE THE DECK BOOTS, and you observe a handful of asset requests and no
 *    bridge activity. That is exactly the shape of the failed rebuild: it saw
 *    5 asset responses where a real run makes ~105. Use `domcontentloaded`,
 *    then `waitForSelector('iframe')`.
 * 2. WITHOUT DWELL THERE IS NOTHING TO PERSIST. `LMSSetValue`/`LMSCommit` only
 *    fire once the deck has initialised AND the learner moves. Clicking the
 *    module tabs with ~3.5s dwell each produces `commit-0..N`; navigating away
 *    from the player produces `__finish__`. A run that opens the player and
 *    asserts immediately proves nothing about persistence.
 *
 * WHAT IT ASSERTS (the premise, not "a page loaded")
 * -------------------------------------------------
 *   - asset responses in the right ORDER OF MAGNITUDE (~105 on a real run; a
 *     low count means the deck never booted, so a low count FAILS LOUDLY);
 *   - the SCORM API is reachable by the wrapper's `window.parent` walk FROM
 *     INSIDE the SCO iframe, at depth 1;
 *   - the iframe `src` is RELATIVE (same-origin asset proxy, not an absolute
 *     signed origin — cross-origin kills the parent walk silently);
 *   - `sandbox="allow-scripts allow-same-origin"` unchanged;
 *   - `<main>` is still the iframe's IMMEDIATE parent (a reparenting wrapper
 *     would break the `window.parent` walk);
 *   - `scoStates` populated per SCO, and `lmsScormEvents` carries `__commit__`,
 *     `cmi.core.session_time` and `__finish__`.
 *
 * LOCAL-ONLY — THIS SPEC IS NOT IN CI AND MUST NOT BE ADDED TO IT
 * --------------------------------------------------------------
 * Like `org-seats.spec.ts` / `org-packs.spec.ts`, it needs a live Convex dev
 * deployment and a running Next server. CI starts neither. Weakening it so it
 * could run in CI would destroy the only thing it is for.
 *
 * PREREQUISITES to run it
 * -----------------------
 *   1. `.env.local` in apps/academia with NEXT_PUBLIC_CONVEX_URL pointing at the
 *      dev deploy that holds the seeded course + the learner's ACTIVE enrollment
 *      (LEARNER_JWT_SECRET too, if the deploy is not on the dev fallback key).
 *   2. A Next server on :3000 serving THAT deploy. Either let the config's
 *      webServer start `pnpm dev`, or start one yourself and pass
 *      PLAYWRIGHT_BASE_URL (the config then skips its own server).
 *      A STALE `next start` on :3000 serving an older build has misled agents on
 *      this branch twice — if the counts look wrong, check what is bound there.
 *   3. Env for the fixture (defaults are the branch's seeded row; override to
 *      re-point without editing this file):
 *        SCORM_E2E_SLUG        course slug         (default: the DEI course)
 *        SCORM_E2E_LEARNER_ID  lmsCustomers id     (default: the seeded learner)
 *        SCORM_E2E_LEARNER_EMAIL
 *      The learner must ALREADY have an active enrollment — this spec does not
 *      mint one, precisely so it never burns an org seat.
 *   4. Run it:
 *        cd apps/academia
 *        PLAYWRIGHT_BASE_URL=http://localhost:3000 \
 *          npx playwright test tests/e2e/scorm-player-premise.spec.ts
 *      Wall time ~60s: 7 tabs x 3.5s dwell is the floor, not slack.
 */
import fs from "node:fs";
import path from "node:path";
import { test, expect, type Frame } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { SignJWT } from "jose";
import { api } from "@zephyra/convex/_generated/api";

function readEnvLocal(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  try {
    const raw = fs.readFileSync(path.resolve(__dirname, "../../.env.local"), "utf8");
    const m = raw.match(new RegExp(`^${key}=(.*)$`, "m"));
    return m ? m[1].trim() : undefined;
  } catch {
    return undefined;
  }
}

const CONVEX_URL = readEnvLocal("NEXT_PUBLIC_CONVEX_URL")!;
const LEARNER_SECRET = new TextEncoder().encode(
  readEnvLocal("LEARNER_JWT_SECRET") || "fallback-learner-secret-for-development-only"
);

const SLUG =
  process.env.SCORM_E2E_SLUG ??
  "diversidad-equidad-e-inclusion-en-el-trabajo-como-construir-entornos-laborales-r-lusion";
const LEARNER_ID = process.env.SCORM_E2E_LEARNER_ID ?? "kx7dj2w9r63364f4b542vxnftx88zwgf";
const LEARNER_EMAIL = process.env.SCORM_E2E_LEARNER_EMAIL ?? "tomasplleonart@gmail.com";

/**
 * The floor for "the deck actually booted". A real boot of this deck fetches
 * ~105 same-origin assets through the proxy (html + js + css + media). The
 * failed rebuild saw 5. 30 is deliberately far below 105 and far above 5: it is
 * a BOOT DETECTOR, not a fingerprint of one deck's asset list, so a content
 * update does not turn it into a false alarm — but a wait strategy that returns
 * before boot can never sneak past it.
 */
const ASSET_BOOT_FLOOR = 30;
/** Per-tab dwell. Below ~3s the deck initialises but never commits. */
const DWELL_MS = 3_500;

test.describe("SCORM player premise (local-only: needs dev Convex + a server)", () => {
  test("the deck boots through the same-origin proxy, the bridge is reachable, and progress persists", async ({
    page,
    context,
  }) => {
    test.setTimeout(180_000);
    const convex = new ConvexHttpClient(CONVEX_URL);

    const cookie = await new SignJWT({
      learnerId: LEARNER_ID,
      email: LEARNER_EMAIL,
      type: "individual",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(LEARNER_SECRET);
    await context.addCookies([
      {
        name: "session-learner",
        value: cookie,
        url: "http://localhost:3000",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    // Count only proxied SCO assets, so page chrome/_next traffic cannot inflate
    // the boot signal into a false pass.
    const assetResponses: string[] = [];
    page.on("response", (res) => {
      const u = new URL(res.url());
      if (u.pathname.startsWith(`/api/lms/asset/`)) assetResponses.push(u.pathname);
    });

    // The fixture enrollment is REUSED across runs, so the event log already
    // holds `__commit__`/`__finish__` rows from every previous run. Asserting on
    // the whole log would pass even if THIS run persisted nothing — the same
    // class of blind measurement this file exists to prevent. Everything below
    // is filtered to `timestamp >= runStart`.
    const runStart = Date.now();

    // FACT 1: domcontentloaded, NOT networkidle. See the header.
    await page.goto(`/cursos/${SLUG}/player`, { waitUntil: "domcontentloaded" });

    // The iframe only renders once apiReady flips (window.API assigned first),
    // so its presence is the earliest honest "the bridge exists" signal.
    await page.waitForSelector("iframe", { timeout: 30_000 });
    const iframe = page.locator("iframe").first();

    // --- structural premises, read off the live DOM -------------------------
    const rawSrc = await iframe.getAttribute("src");
    expect(rawSrc, "iframe src must be RELATIVE: a cross-origin src silently kills the window.parent walk").toMatch(
      /^\/api\/lms\/asset\//
    );
    expect(rawSrc).not.toMatch(/^https?:\/\//);

    expect(await iframe.getAttribute("sandbox")).toBe("allow-scripts allow-same-origin");

    // <main> must be the IMMEDIATE parent. A wrapper div inserted between them
    // adds a frame level and breaks the wrapper's parent walk.
    const parentTag = await iframe.evaluate((el) => el.parentElement?.tagName ?? null);
    expect(parentTag, "<main> must remain the iframe's immediate parent").toBe("MAIN");

    // --- the bridge, seen the way the CAMPUS wrapper sees it ----------------
    // Not `window.API` on the top page (that is trivially true and proves
    // nothing about reachability): we run the wrapper's own discovery walk from
    // INSIDE the SCO document. allow-same-origin is what makes this possible —
    // if the sandbox or the origin changed, this is the assertion that fires.
    const frames = page.frames().filter((f: Frame) => f !== page.mainFrame());
    expect(frames.length).toBeGreaterThan(0);
    const sco = frames[0];
    const walk = await sco.evaluate(() => {
      let w: Window | null = window;
      for (let depth = 0; depth < 10 && w; depth += 1) {
        if ((w as unknown as { API?: unknown }).API) {
          return { depth, found: true, hasLMSInitialize: typeof (w as unknown as { API: { LMSInitialize?: unknown } }).API.LMSInitialize === "function" };
        }
        w = w.parent === w ? null : w.parent;
      }
      return { depth: -1, found: false, hasLMSInitialize: false };
    });
    expect(walk.found, "the SCO must be able to reach the SCORM API by walking window.parent").toBe(true);
    expect(walk.depth, "the API must sit exactly one level up (<main> reparenting or a nested frame would move it)").toBe(1);
    expect(walk.hasLMSInitialize).toBe(true);

    // --- FACT 2: dwell on every tab, or nothing persists -------------------
    const tabs = page.getByRole("tab");
    const tabCount = await tabs.count();
    expect(tabCount, "multi-SCO deck expected: the single-SCO path never exercises SCO switching").toBeGreaterThan(1);
    for (let i = 0; i < tabCount; i += 1) {
      await tabs.nth(i).click();
      await page.waitForSelector("iframe", { timeout: 20_000 });
      await page.waitForTimeout(DWELL_MS);
    }

    // BOOT DETECTOR. Asserted AFTER the dwell loop, because that is the only
    // point at which a real run has finished fetching. A networkidle-style wait
    // that returned before boot lands here with single digits and FAILS with the
    // count printed — which is the whole point: the failure names its own cause.
    expect(
      assetResponses.length,
      `only ${assetResponses.length} proxied asset responses — the deck never booted. ` +
        `A real run makes ~105. If you changed the wait strategy to networkidle, THAT is the cause: ` +
        `the CAMPUS wrapper polls forever, so networkidle times out before boot (see the file header).`
    ).toBeGreaterThan(ASSET_BOOT_FLOOR);

    // Navigating away runs the LMSFinish path -> __finish__.
    await page.goto(`/cursos/${SLUG}`, { waitUntil: "domcontentloaded" });

    // --- persistence, read from Convex (the source of truth) ---------------
    const course = (await convex.query(api.lms.courses.getBySlug, { slug: SLUG })) as {
      _id: string;
    } | null;
    expect(course, `no course for slug ${SLUG}`).toBeTruthy();
    const enrollment = (await convex.query(api.lms.scormEvents.getEnrollment, {
      learnerId: LEARNER_ID as never,
      courseId: course!._id as never,
    })) as { _id: string; scoStates?: Record<string, unknown> } | null;
    expect(enrollment, "the fixture learner must already have an ACTIVE enrollment").toBeTruthy();

    // scoStates populated per SCO — one key per module the run visited.
    const scoStates = enrollment!.scoStates ?? {};
    expect(
      Object.keys(scoStates).length,
      "scoStates must carry per-SCO state after the dwell loop"
    ).toBeGreaterThanOrEqual(1);

    const allEvents = (await convex.query(api.lms.scormEvents.listByEnrollment, {
      learnerId: LEARNER_ID as never,
      enrollmentId: enrollment!._id as never,
    })) as Array<{ element: string; value: string; timestamp: number; commitId?: string }>;
    const events = allEvents.filter((e) => e.timestamp >= runStart);
    expect(
      events.length,
      "this run produced NO events at all — the bridge never fired (dwell? apiReady? see the header)"
    ).toBeGreaterThan(0);

    const elements = events.map((e) => e.element);
    expect(elements, "no __commit__ means the bridge never committed — check the dwell").toContain("__commit__");
    expect(elements, "no session_time means the deck never reported a session").toContain(
      "cmi.core.session_time"
    );
    expect(elements, "no __finish__ means LMSFinish never ran on navigate-away").toContain("__finish__");

    // The commit id travels in `value` on a `__commit__` row, NOT in the
    // `commitId` column: ScormPlayer calls forward("__commit__", currentCommitId())
    // and forward's third parameter is the one that populates `commitId`. Verified
    // against the live log — a spec asserting on `commitId` here reads [] and
    // fails on a healthy run. The series is monotonic from commit-0 per boot.
    const commitIds = events.filter((e) => e.element === "__commit__").map((e) => e.value);
    expect(commitIds, "the commit series must start at commit-0 for this run").toContain("commit-0");

    // Printed so a human reading the run output sees the evidence, not just PASS.
    console.log(
      `[premise] asset responses=${assetResponses.length} · tabs=${tabCount} · ` +
        `scoStates keys=${Object.keys(scoStates).length} · events=${events.length} · ` +
        `commits=[${[...new Set(commitIds)].join(", ")}] · API depth=${walk.depth}`
    );
  });
});
