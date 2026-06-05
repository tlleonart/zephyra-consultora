/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import path from "node:path";

// Node environment is the default; suites that need DOM (e.g. middleware
// thin shim) opt-in via the per-file pragma `// @vitest-environment jsdom`.
// We keep node here because convex/model + convex/lms tests run faster and
// closer to the V8 isolate they target.
export default defineConfig({
  resolve: {
    alias: {
      // Mirror tsconfig.json paths so unit tests can import "@/lib/foo".
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: [
      "tests/unit/**/*.test.ts",
      "tests/unit/**/*.test.tsx",
    ],
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    // Convex code uses Web Crypto + WASM (hash-wasm); Node 20 has both natively.
    // Keep pool default (forks) so each suite gets a clean module cache for the
    // env-driven HMAC key cache in convex/model/passwords.ts.
  },
});
