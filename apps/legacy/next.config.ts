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
