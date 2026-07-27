import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app is now nested at apps/legacy inside a pnpm workspace, so Next has
  // to infer the workspace root when tracing files for the standalone output.
  // Its heuristic walks up looking for a lockfile and can land outside the repo
  // (a stray, unrelated package-lock.json in the user profile above the
  // checkout is enough to mislead it), which emits a warning and traces the
  // wrong tree. Pin it to the monorepo root explicitly.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // The shared workspace packages are SOURCE-exported: their `exports` maps
  // point straight at TypeScript (and, for @zephyra/ui, .tsx + CSS Modules +
  // styled-jsx) rather than at pre-built JS, so Next has to run them through
  // its own SWC/CSS pipeline. Without this, `next build` fails on the raw
  // `import type`/JSX/`.module.css` inside node_modules/@zephyra/*.
  //
  // Note @zephyra/convex is deliberately ABSENT: its two entry points need no
  // compilation (`_generated/api.js` is already plain ESM and
  // `_generated/dataModel` is types-only, so consumers elide it). The rule is
  // per-package, not a blanket "all workspace deps" — see packages/*/README.md.
  transpilePackages: ["@zephyra/utils"],
  // Lint is a dedicated CI job (`pnpm turbo run lint`) and a separate local step, not a
  // build-time gate. Before an ESLint config existed in this repo, `next build`
  // skipped linting entirely; adding the config (Sprint 0 Phase C) otherwise
  // couples the pre-existing institutional lint debt into every build. We keep
  // `next build` focused on compilation + typechecking and run ESLint
  // independently so the build (and Vercel preview) stays green.
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.convex.cloud",
      },
    ],
  },
};

export default nextConfig;
