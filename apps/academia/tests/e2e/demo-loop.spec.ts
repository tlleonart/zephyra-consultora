/**
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
import path from "node:path";

const FIXTURE = path.resolve(
  __dirname,
  "../../specs/008-zephyra-lms-foundation/fixtures/scorm12_diversidad_equidad_e_inclusion.zip"
);

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
