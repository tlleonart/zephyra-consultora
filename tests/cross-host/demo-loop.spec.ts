/**
 * ⛔ QUARANTINED — TWO-HOST FLOW, NOT RUNNABLE IN ANY SINGLE WORKSPACE.
 * ────────────────────────────────────────────────────────────────────
 * Quarantined here at T-fe-009. This file lives at the REPO ROOT, deliberately
 * OUTSIDE every workspace (`pnpm-workspace.yaml` declares only `apps/*` and
 * `packages/*`) and outside every test glob: no root vitest config exists, each
 * app's vitest `include` is `tests/unit/**`, and apps/academia's Playwright
 * `testDir` is `./tests/e2e`. Nothing collects it. That is intentional.
 *
 * WHY. After the app split (M3, domain-boundaries v1.1 §3) this single spec
 * spans TWO hosts against one Playwright `baseURL`:
 *   - `/login`, `/admin`, `/admin/lms/courses/new`  → apps/backoffice
 *   - `/cursos`, `/cursos/<slug>/player`            → apps/academia
 * It briefly sat in apps/academia/tests/e2e/ (moved wholesale with the rest of
 * the learner surface at T-fe-008), where it TYPECHECKED and LINTED and was not
 * CI-run — so nothing reported it as broken while it presented as academia
 * coverage that does not exist. Every step before the player would 404 on the
 * academia host.
 *
 * ALSO BROKEN BY THAT MOVE (fixed here): the FIXTURE path. `__dirname/../..`
 * resolved to `apps/academia/` after the move, so it pointed at
 * `apps/academia/specs/...` — a directory that has never existed. From this
 * location `../..` is the repo root again, which is where `specs/` actually is,
 * so the original literal is correct once more. Asserted at module scope below
 * rather than left to fail 30s into a run.
 *
 * WHEN IT COMES BACK. T-e2e-018 (M6.6 go-live checklist) owns cross-host e2e:
 * SCORM player on prod, pack purchase + seat invite + claim. This spec is named
 * in that task's scope. (The V27/V21 rulings call that row "T-e2e-019"; no such
 * row exists -- M6.6 is T-e2e-018.) Running it requires what no single workspace can give
 * it: two base URLs (one per host) and a live Convex deploy. Do NOT "fix" it by
 * moving it back into an app — a single-baseURL harness cannot express it.
 *
 * ORIGINAL HEADER FOLLOWS.
 * ────────────────────────────────────────────────────────────────────
 * Sprint-0 demo-loop regression guard (SDD §6 SC #5).
 *
 * Reproduces the centerpiece end-to-end in CI/local:
 *   admin login -> upload SCORM zip -> ingest action runs ->
 *   publish course -> open player -> SCORM 1.2 API found in iframe.
 *
 * REQUIREMENTS to run locally:
 *   1. `npm run dev` is launched automatically by playwright.config webServer.
 *   2. Convex dev deployment `dev:exuberant-corgi-88` is reachable; the
 *      `NEXT_PUBLIC_CONVEX_URL` env var must point at it (set in .env.local).
 *   3. Admin creds: `martinaafay@gmail.com / 12345678` (lazy-rehash path
 *      works post-B01) OR override via E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD.
 *   4. Fixture present at specs/008-zephyra-lms-foundation/fixtures/
 *      scorm12_diversidad_equidad_e_inclusion.zip (29 MB, kept out of node
 *      transit; referenced by absolute path).
 *
 * The spec deliberately AVOIDS asserting that lmsScormEvents rows exist —
 * doing so would require a parallel Convex client in the test runner and a
 * deploy-key, both of which sit outside the Sprint-1 B-track. The console
 * signal `[SCORM 1.2] SCORM 1.2 API encontrada` (emitted by scorm-again
 * when it locates the API on parent windows) is a sufficient regression
 * proxy: if the bridge never initializes, no events can be recorded.
 */
import { test, expect, type ConsoleMessage } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// __dirname is <repo-root>/tests/cross-host, so `../..` is the repo root, which
// is where specs/ lives. This resolved to the non-existent apps/academia/specs/
// while the file sat in apps/academia/tests/e2e/ — see the quarantine header.
const FIXTURE = path.resolve(
  __dirname,
  "../../specs/008-zephyra-lms-foundation/fixtures/scorm12_diversidad_equidad_e_inclusion.zip"
);

// Fail LOUDLY and immediately if the fixture path is wrong again, instead of
// timing out inside setInputFiles half a minute into a run.
if (!fs.existsSync(FIXTURE)) {
  throw new Error(
    `demo-loop fixture not found at ${FIXTURE} — the SCORM zip is Git-LFS tracked; run \`git lfs pull\`, and if this file has moved, re-derive the path from the repo root.`
  );
}

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "martinaafay@gmail.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "12345678";

test.describe("demo loop — Sprint 0 centerpiece", () => {
  test("admin can ingest, publish, and launch a SCORM 1.2 course", async ({ page }) => {
    const consoleMessages: ConsoleMessage[] = [];
    page.on("console", (msg) => consoleMessages.push(msg));

    // --- Step 1: admin login ---
    await page.goto("/login");
    // LoginForm.tsx uses native <label htmlFor>; targeting by name= is the
    // most stable selector (labels carry Spanish text that may shift).
    await page.locator('input[name="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[name="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /iniciar sesi[oó]n/i }).click();
    await page.waitForURL(/\/admin/, { timeout: 30_000 });

    // --- Step 2: navigate to new-course page and upload the fixture ---
    await page.goto("/admin/lms/courses/new");
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(FIXTURE);

    // --- Step 3: trigger ingest, wait for the redirect/feedback ---
    const submit = page.getByRole("button", { name: /subir|ingestar|upload|submit/i }).first();
    if (await submit.isVisible().catch(() => false)) {
      await submit.click();
    }
    // The ingest action takes a few seconds (parse + storage uploads).
    // Wait for any of: redirect to course detail, or a success toast.
    await page.waitForLoadState("networkidle", { timeout: 60_000 });

    // --- Step 4: publish the course ---
    // Look for either an explicit "Publicar" button on the detail page,
    // or fall back to navigating to the courses list and picking the first row.
    const publishBtn = page.getByRole("button", { name: /publicar|publish/i }).first();
    if (await publishBtn.isVisible().catch(() => false)) {
      await publishBtn.click();
      await page.waitForLoadState("networkidle", { timeout: 15_000 });
    }

    // --- Step 5: navigate to the public player ---
    // Read the slug from the current URL if we're on /admin/lms/courses/<id>,
    // else fall back to scanning the courses list for a published row.
    await page.goto("/cursos");
    const courseLink = page.locator('a[href^="/cursos/"]').first();
    await expect(courseLink).toBeVisible({ timeout: 15_000 });
    const href = await courseLink.getAttribute("href");
    expect(href).toBeTruthy();
    await page.goto(`${href}/player`);

    // --- Step 6: wait for the iframe to load and the SCORM 1.2 API to attach ---
    const iframe = page.locator("iframe").first();
    await expect(iframe).toBeVisible({ timeout: 30_000 });

    // The scorm-again bridge logs once it finds API_1484_11/API on a parent.
    // We tolerate either the canonical Spanish line or any line with
    // "SCORM 1.2 API" — content/wording may shift across scorm-again versions.
    const bridgeFound = await page
      .waitForEvent("console", {
        predicate: (msg) =>
          /SCORM 1\.2.*encontrada|SCORM 1\.2 API|LMSInitialize/i.test(msg.text()),
        timeout: 30_000,
      })
      .then(() => true)
      .catch(() => false);

    // If we didn't catch it as a live event (could have fired pre-listener),
    // scan the buffered messages.
    const found =
      bridgeFound ||
      consoleMessages.some((m) =>
        /SCORM 1\.2.*encontrada|SCORM 1\.2 API|LMSInitialize/i.test(m.text())
      );
    expect(found).toBe(true);
  });
});
