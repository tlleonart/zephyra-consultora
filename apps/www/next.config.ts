import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Same reason as apps/legacy: this app is nested inside a pnpm workspace, so
  // Next's workspace-root heuristic (walk up looking for a lockfile) can land
  // outside the checkout and trace the wrong tree. Pin it to the monorepo root.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // REQUIRED, not optional. @zephyra/ui and @zephyra/utils are SOURCE-exported:
  // their `exports` maps point at .tsx / .ts / .module.css, so Next must run
  // them through its own SWC + CSS pipeline. Without this, `next build` fails on
  // raw JSX / `import type` / `.module.css` inside node_modules/@zephyra/*.
  //
  // @zephyra/convex is deliberately ABSENT (same as apps/legacy): its entry
  // points need no compilation — `_generated/api.js` is plain ESM and
  // `_generated/dataModel` is types-only. The rule is per-package.
  transpilePackages: ["@zephyra/ui", "@zephyra/utils"],
  // Lint is a dedicated CI job (`pnpm turbo run lint`), not a build-time gate —
  // mirrors apps/legacy so the institutional lint debt does not couple into
  // every build.
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
