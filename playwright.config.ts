import { defineConfig, devices } from "@playwright/test";

// Lean Playwright config: chromium only, single project, dev-server-managed.
// The demo-loop spec requires a live Convex dev deployment (dev:exuberant-corgi-88)
// reachable via NEXT_PUBLIC_CONVEX_URL; CI does not start one, so e2e runs
// PR-only via a separate workflow that gates on a secret. See ci.yml for the
// rationale documented inline.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // demo loop mutates a shared Convex deploy; serialize
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
