/**
 * Sprint LMS-3a Phase E — B2B seat-pack frontend walkthrough.
 *
 * Drives the org-owner spine end-to-end against the live Convex dev deploy
 * (dev:exuberant-corgi-88):
 *   1. org sign-up form renders + accepts input (E1)
 *   2. owner session is established (we mint it via the same public mutations +
 *      the dev learner-session JWT the app uses), org created (createOrganization)
 *   3. B2B catalog lists the buyable course (E2)
 *   4. the live volume-discount calculator updates across bands:
 *        5 → 0%,  15 → 10%,  30 → 20%,  60 → Contactanos (no checkout button) (E2)
 *      and the displayed total matches computePackPrice (50/135/240).
 *   5. "Comprar para mi equipo" produces a MercadoPago checkout redirect (E3)
 *      — we stop at the MP redirect boundary (the sandbox purchase is the
 *      G3 manual test).
 *
 * REQUIREMENTS to run locally:
 *   - `npm run dev` (auto-started by playwright.config webServer)
 *   - Convex dev deploy reachable via NEXT_PUBLIC_CONVEX_URL (.env.local)
 *   - pack/org functions deployed + lmsVolumeDiscountTiers seeded on the deploy
 *   - a published + purchasable course exists (the DEI course, priceUsd 10)
 *
 * The owner session JWT is signed with the SAME dev fallback the app uses when
 * LEARNER_JWT_SECRET is unset (see features/auth-learner/lib/session.ts). This
 * mirrors the dev runtime exactly — no secret divergence.
 */
import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { SignJWT } from "jose";
import { api } from "@zephyra/convex/_generated/api";

// Playwright's node runner does not load .env.local; read the Convex URL from it
// so the setup client targets the same dev deploy the app uses.
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
  process.env.LEARNER_JWT_SECRET ||
    "fallback-learner-secret-for-development-only"
);

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

test.describe("org seat-pack spine — Sprint 3a Phase E", () => {
  test("sign-up form renders + validates", async ({ page }) => {
    // Dev-server compile race can 404 the very first hit while the route is
    // still compiling; retry the goto until the form heading renders.
    await expect(async () => {
      await page.goto("/empresa/registro", { waitUntil: "networkidle" });
      await expect(
        page.getByRole("heading", { name: /cre[aá] la cuenta de tu empresa/i })
      ).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
    await expect(page.locator('input[name="orgName"]')).toBeVisible();
    await expect(page.locator('input[name="adminName"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();

    // Empty org name → inline validation, no magic-link request.
    await page.locator('input[name="adminName"]').fill("Ada Lovelace");
    await page.locator('input[name="email"]').fill("nobody@example.com");
    await page.getByRole("button", { name: /recibir link/i }).click();
    await expect(page.locator("#org-signup-error")).toContainText(
      /nombre de tu organizaci[oó]n/i
    );
  });

  test("owner: catalog → live calculator across bands → checkout redirect", async ({
    page,
    context,
  }) => {
    const convex = new ConvexHttpClient(CONVEX_URL);

    // --- setup: create a verified owner + org via the public mutations -------
    const email = `e2e-org-${Date.now()}@example.com`;
    const link = await convex.mutation(api.lms.auth.requestMagicLink, {
      email,
      purpose: "learner_activation",
    });
    expect(link.rawToken).toBeTruthy();
    const consumed = await convex.mutation(api.lms.auth.consumeMagicLink, {
      token: link.rawToken as string,
      purpose: "learner_activation",
    });
    const customerId = consumed.customer._id as string;
    const org = await convex.mutation(api.lms.org.createOrganization, {
      ownerCustomerId: customerId as never,
      name: "Equipo E2E S.A.",
    });

    const cookie = await mintOwnerSessionCookie({
      _id: customerId,
      email,
      organizationId: org.organizationId,
    });
    await context.addCookies([
      {
        name: "session-learner",
        value: cookie,
        url: "http://localhost:3000",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    // --- E2: B2B catalog lists the buyable course ---------------------------
    await expect(async () => {
      await page.goto("/empresa/cursos", { waitUntil: "networkidle" });
      await expect(
        page.getByRole("heading", { name: /cat[aá]logo para equipos/i })
      ).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
    const courseCard = page.locator('a[href^="/empresa/cursos/"]').first();
    await expect(courseCard).toBeVisible({ timeout: 15_000 });
    const href = await courseCard.getAttribute("href");
    expect(href).toBeTruthy();

    // --- E2: per-course live calculator -------------------------------------
    const seatInput = page.getByLabel(/cantidad de lugares/i);
    await expect(async () => {
      await page.goto(href as string, { waitUntil: "networkidle" });
      await expect(seatInput).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000 });

    // 5 seats → 0% discount, total US$ 50, checkout button present.
    await seatInput.fill("5");
    await expect(page.getByText(/sin descuento/i).first()).toBeVisible();
    await expect(page.getByText(/US\$\s*50\b/)).toBeVisible({ timeout: 10_000 });

    // 15 seats → 10% discount, total US$ 135.
    await seatInput.fill("15");
    await expect(page.getByText(/−10%|-10%/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/US\$\s*135\b/)).toBeVisible({ timeout: 10_000 });

    // 30 seats → 20% discount, total US$ 240.
    await seatInput.fill("30");
    await expect(page.getByText(/−20%|-20%/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/US\$\s*240\b/)).toBeVisible({ timeout: 10_000 });

    // 60 seats → Contactanos branch: contact CTA present, NO checkout button.
    await seatInput.fill("60");
    await expect(
      page.getByRole("link", { name: /contactanos/i })
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole("button", { name: /comprar para mi equipo/i })
    ).toHaveCount(0);

    // --- E3: back to a purchasable band → checkout redirect boundary --------
    await seatInput.fill("15");
    const buyBtn = page.getByRole("button", {
      name: /comprar para mi equipo/i,
    });
    await expect(buyBtn).toBeVisible({ timeout: 10_000 });

    // Stop at the MP boundary (the sandbox purchase is the G3 manual test).
    // Intercept the off-site navigation: when the BuyButton drives the browser
    // to the MercadoPago Checkout Pro URL, capture that URL and abort the
    // request so the test never leaves the app. The captured URL proves the
    // createPackCheckout action returned a real MP redirect.
    let mpUrl = "";
    await page.route(/mercadopago\.|mercadolibre\.|mpago\.|sandbox\./i, (route) => {
      mpUrl = route.request().url();
      return route.abort();
    });
    await buyBtn.click();
    await expect
      .poll(() => mpUrl, { timeout: 25_000 })
      .toMatch(/mercadopago|mercadolibre|mpago|sandbox/i);
  });
});
