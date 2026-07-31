/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import path from "node:path";

// Mirrors apps/academia's config, minus the JSX runtime override: this app has
// no email components to render in a suite, so the default esbuild JSX handling
// is untouched. `environment: "node"` for the same reason as the sibling apps —
// jsdom is deliberately NOT a dependency of this workspace, so the
// `// @vitest-environment jsdom` pragma would fail at collection.
//
// Added at M4 (T-be-010): the workspace already declared
// `"test": "vitest run --passWithNoTests"` and carried vitest as a devDependency,
// but had no config and no suites, so boundaries §5 row 1 (www generates no app
// URLs) had nowhere to live. No new dependency was needed.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    globals: true,
    environment: "node",
  },
});
