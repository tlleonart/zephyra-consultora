/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import path from "node:path";

// Node is the only environment available: `jsdom` is deliberately NOT a
// dependency of this workspace and no suite uses the `// @vitest-environment
// jsdom` pragma. The pragma is therefore a trap — vitest resolves the
// environment lazily, so the first file to add it fails at collection with
// "Cannot find package 'jsdom'". If a future suite genuinely needs a DOM, add
// `jsdom` to devDependencies in the same change that adds the pragma.
// We keep node here because convex/model + convex/lms tests run faster and
// closer to the V8 isolate they target.
export default defineConfig({
  resolve: {
    alias: {
      // Mirror tsconfig.json paths so unit tests can import "@/lib/foo".
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // React 19's automatic JSX runtime: tsconfig has `jsx: preserve` because
  // Next.js handles the transform, but vitest uses esbuild and would default
  // to the classic runtime (which needs `React` in scope). Email components
  // (src/emails/*.tsx) opt every suite that imports them into the modern
  // runtime so we don't have to sprinkle `import React from 'react'`.
  esbuild: {
    jsx: "automatic",
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
