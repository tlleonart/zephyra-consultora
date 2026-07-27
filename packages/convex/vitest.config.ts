/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

// Unit suite for the Convex backend. Lifted from apps/legacy/vitest.config.ts
// with only the parts this package actually needs:
//
//  - No `resolve.alias` for "@": the convex suites import their subjects through
//    relative paths into ./convex, never through the app's "@/..." alias.
//  - No `esbuild.jsx` override: nothing here is .tsx and no suite imports the
//    app's React email components. (apps/legacy still needs both.)
//
// `environment: "node"` is not just a default — it is the only environment
// available: `jsdom` is deliberately not a dependency, so a
// `// @vitest-environment jsdom` pragma would fail at collection. Convex code
// uses Web Crypto + WASM (hash-wasm), both native in Node 20.
//
// Pool stays the default (forks) so each suite gets a clean module cache: the
// env-driven HMAC key cache in convex/model/passwords.ts is module-level state.
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
  },
});
