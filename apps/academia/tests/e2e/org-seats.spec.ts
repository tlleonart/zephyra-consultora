/**
 * Sprint LMS-3b Phase E7 — B2B seat lifecycle e2e (invite → claim → player →
 * dashboard) against the live Convex dev deploy (dev:exuberant-corgi-88).
 *
 * WHAT IS SIMULATED vs REAL
 * -------------------------
 * SIMULATED (the MP purchase only): a real MercadoPago sandbox purchase cannot
 *   be completed headlessly, so we drive the SERVER-SIDE paid-pack state the way
 *   the 3a packMoneyPath release-gate does — `npx convex run` the internal
 *   mutations the approved webhook would call:
 *     createPackOrder (snapshot the server-priced pack order)
 *       → mintSeatPackForOrder (mint exactly one lmsSeatPacks + N lmsSeats).
 *   This is the EXACT post-payment state the webhook produces; nothing about the
 *   seat/claim/player/dashboard mechanics is faked.
 * REAL (everything else, against dev): org sign-up (public mutations), the seat
 *   invite (requestSeatInvite — the same gated mutation the dashboard server
 *   action calls; we read the rawToken here because a headless test cannot open
 *   the invite email), the CLAIM LANDING PAGE (the real /empresa/invitacion UI
 *   driving the claimSeat action), the PLAYER opening for the claimed learner,
 *   the org dashboard reflecting the claim, and the nominal read without consent
 *   showing the "sin consentimiento" state.
 *
 * ASSERTIONS (per the task DoD):
 *   - the dashboard pack card shows total / asignados / disponibles after mint;
 *   - the claim consumes EXACTLY ONE seat — disponibles decrements by 1 in the
 *     dashboard after the claim;
 *   - the player opens for the claimed learner (enrollment gate passes);
 *   - the aggregate dashboard reflects the new enrollment (totalClaimed ≥ 1);
 *   - a nominal read WITHOUT consent renders the "sin consentimiento" state.
 *
 * REQUIREMENTS to run locally:
 *   - `npm run dev` (auto-started by playwright.config webServer)
 *   - Convex dev deploy reachable via NEXT_PUBLIC_CONVEX_URL (.env.local) with
 *     the 3b functions deployed + a published+purchasable course (DEI, priceUsd 10)
 *   - `npx convex` authenticated against the same dev deploy (CONVEX_DEPLOYMENT)
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
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
  process.env.LEARNER_JWT_SECRET || "fallback-learner-secret-for-development-only"
);
const REPO_ROOT = path.resolve(__dirname, "../..");

// The DEI course (published + purchasable, priceUsd 10) — the same fixture the
// 3a spec relies on. We resolve it dynamically so a re-seed with a new id passes.
async function resolveBuyableCourse(convex: ConvexHttpClient) {
  const courses = await convex.query(api.lms.courses.listPublished, {});
  const c = courses.find(
    (x) => x.isPurchasable === true && typeof x.priceUsd === "number" && x.priceUsd > 0
  );
  if (!c || typeof c.priceUsd !== "number") {
    throw new Error("no buyable course on the dev deploy");
  }
  return { _id: c._id, slug: c.slug, priceUsd: c.priceUsd };
}

// SIMULATED MP purchase: run the internal mutations the approved webhook calls.
// `convex run` executes against the deploy in CONVEX_DEPLOYMENT with admin auth,
// which is the only way to reach an internalMutation from a test harness.
function convexRun(fn: string, args: Record<string, unknown>): unknown {
  // shell:true (needed for npx.cmd on Windows); wrap the JSON in double quotes
  // and escape inner quotes as \" so cmd.exe / sh delivers valid JSON (not the
  // quote-stripped JSON5 a bare arg would become).
  const jsonArg = JSON.stringify(args).replace(/"/g, '\\"');
  const out = execSync(`npx convex run ${fn} "${jsonArg}"`, {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  const trimmed = out.trim();
  return trimmed ? JSON.parse(trimmed) : null;
}

async function mintOwnerSessionCookie(learner: {
  _id: string;
  email: string;
  organizationId: string;
}): Promise<string> {
  return new SignJWT({
    learnerId: learner._id,
    email: learner.email,
    type: "org_admin",
    organizationId: learner.organizationId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(LEARNER_SECRET);
}

test.describe("B2B seat lifecycle — Sprint 3b Phase E7", () => {
  test("invite → claim → player opens → dashboard reflects one consumed seat", async ({
    page,
    context,
  }) => {
    test.setTimeout(120_000);
    const convex = new ConvexHttpClient(CONVEX_URL);
    const course = await resolveBuyableCourse(convex);

    // --- REAL: org sign-up via the public mutations --------------------------
    const ownerEmail = `e2e-owner-${Date.now()}@example.com`;
    const link = await convex.mutation(api.lms.auth.requestMagicLink, {
      email: ownerEmail,
      purpose: "learner_activation",
    });
    const consumed = await convex.mutation(api.lms.auth.consumeMagicLink, {
      token: link.rawToken as string,
      purpose: "learner_activation",
    });
    const ownerId = consumed.customer._id as string;
    const org = await convex.mutation(api.lms.org.createOrganization, {
      ownerCustomerId: ownerId as never,
      name: "Equipo Seats E2E S.A.",
    });
    const organizationId = org.organizationId as string;

    // --- SIMULATED MP purchase: drive the paid-pack mint server-side ---------
    const SEAT_COUNT = 3;
    const orderRes = convexRun("lms/packs:createPackOrder", {
      organizationId,
      customerId: ownerId,
      courseId: course._id,
      seatCount: SEAT_COUNT,
      unitPriceUsd: course.priceUsd,
      appliedDiscountPct: 0,
      totalPriceUsd: course.priceUsd * SEAT_COUNT,
    }) as { _id: string };
    const orderId = orderRes._id;
    const mintRes = convexRun("lms/packs:mintSeatPackForOrder", { orderId }) as {
      seatPackId: string;
      minted: boolean;
    };
    expect(mintRes.seatPackId).toBeTruthy();

    // --- owner session + dashboard reflects the minted pack ------------------
    const ownerCookie = await mintOwnerSessionCookie({
      _id: ownerId,
      email: ownerEmail,
      organizationId,
    });
    await context.addCookies([
      {
        name: "session-learner",
        value: ownerCookie,
        url: "http://localhost:3000",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    await expect(async () => {
      await page.goto("/empresa", { waitUntil: "networkidle" });
      await expect(
        page.getByRole("heading", { name: /cursos contratados/i })
      ).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 40_000 });

    // total / asignados / disponibles present; disponibles starts at SEAT_COUNT.
    const available = page.getByTestId("pack-available").first();
    await expect(available).toHaveText(String(SEAT_COUNT));

    // --- REAL: seat invite (same gated mutation the dashboard action calls) ---
    // We read the rawToken here because a headless test cannot open the email
    // the server action sends; the claim LANDING below is fully real UI.
    const employeeEmail = `e2e-emp-${Date.now()}@example.com`;
    const invite = (await convex.mutation(api.lms.seats.requestSeatInvite, {
      callerCustomerId: ownerId as never,
      organizationId: organizationId as never,
      seatPackId: mintRes.seatPackId as never,
      employeeEmail,
    })) as { rawToken: string | null; claimRequestId: string | null; alreadyPending: boolean };
    expect(invite.rawToken).toBeTruthy();
    expect(invite.claimRequestId).toBeTruthy();

    // --- REAL: claim landing UI drives claimSeat -----------------------------
    const claimUrl =
      `/empresa/invitacion?token=${encodeURIComponent(invite.rawToken as string)}` +
      `&cr=${encodeURIComponent(invite.claimRequestId as string)}` +
      `&org=${encodeURIComponent(organizationId)}` +
      `&pack=${encodeURIComponent(mintRes.seatPackId)}`;

    // The claim mints an org_learner session cookie, replacing the owner cookie.
    await page.goto(claimUrl, { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: /activá tu acceso/i })
    ).toBeVisible({ timeout: 15_000 });
    await page.getByLabel(/tu email/i).fill(employeeEmail);
    await page.getByRole("button", { name: /activar mi acceso/i }).click();

    // --- REAL: player opens for the claimed learner --------------------------
    await expect(
      page.getByRole("button", { name: /ir al curso/i })
    ).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /ir al curso/i }).click();
    // The player route loads (enrollment gate passes for the claimed learner).
    await expect.poll(() => page.url(), { timeout: 20_000 }).toMatch(/\/cursos\/.+\/player/);
    // "no tenés acceso" must NOT appear — the enrollment exists.
    await expect(page.getByText(/no tenés acceso/i)).toHaveCount(0);

    // --- REAL: dashboard reflects the consumed seat (disponibles --) ---------
    // Re-attach the OWNER cookie (the claim swapped it for the org_learner one).
    await context.clearCookies();
    await context.addCookies([
      {
        name: "session-learner",
        value: ownerCookie,
        url: "http://localhost:3000",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await page.goto("/empresa", { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: /cursos contratados/i })
    ).toBeVisible({ timeout: 15_000 });
    // disponibles decremented by exactly one (SEAT_COUNT - 1).
    await expect(page.getByTestId("pack-available").first()).toHaveText(
      String(SEAT_COUNT - 1)
    );
    // aggregate reflects the enrollment: the member appears in the roster.
    await expect(page.getByText(employeeEmail)).toBeVisible({ timeout: 10_000 });

    // --- REAL: nominal read WITHOUT consent → "sin consentimiento" state -----
    // Open the per-member nominal drill-down; the learner never granted consent,
    // so getNominalProgress throws server-side and the dialog shows the state.
    const memberRow = page
      .getByRole("row")
      .filter({ hasText: employeeEmail });
    await memberRow.getByRole("button", { name: /ver progreso/i }).click();
    await expect(
      page.getByRole("dialog").getByText(/sin consentimiento/i)
    ).toBeVisible({ timeout: 15_000 });
  });
});
