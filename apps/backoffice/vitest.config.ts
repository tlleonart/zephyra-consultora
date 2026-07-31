/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import path from "node:path";

// Added at T-fe-009. This workspace had NO test config and NO tests at all
// (its `test` script was `vitest run --passWithNoTests`, which is why an empty
// admin-side suite never showed up as a gap). The admin-branch coverage that
// apps/legacy carried — the middleware admin branch and the admin half of the
// cross-surface escalation guard — is re-homed here before apps/legacy is
// deleted.
//
// Node is the only environment available: `jsdom` is deliberately NOT a
// dependency of this workspace and no suite uses the `// @vitest-environment
// jsdom` pragma. The pragma is therefore a trap — vitest resolves the
// environment lazily, so the first file to add it fails at collection with
// "Cannot find package 'jsdom'". If a future suite genuinely needs a DOM, add
// `jsdom` to devDependencies in the same change that adds the pragma. The
// suites here are pure logic (JWT sign/verify, middleware via NextRequest).
export default defineConfig({
  resolve: {
    alias: {
      // Mirror tsconfig.json paths so unit tests can import "@/lib/foo".
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // React 19's automatic JSX runtime: tsconfig has `jsx: preserve` because
  // Next.js handles the transform, but vitest uses esbuild and would default to
  // the classic runtime (which needs `React` in scope). Kept identical to
  // apps/academia's config so a future .tsx suite here needs no config change.
  esbuild: {
    jsx: "automatic",
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
  },
});
