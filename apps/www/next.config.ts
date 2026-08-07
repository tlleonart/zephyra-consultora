import path from "node:path";
import type { NextConfig } from "next";
import { buildCutoverRedirects } from "./src/lib/cutover-redirects";

const nextConfig: NextConfig = {
  // The apex 301 map. Post-split this app is the ONLY thing served from
  // zephyraconsultora.com, so every URL that moved to academia or backoffice
  // needs a redirect here or it 404s on cutover day — including links already in
  // inboxes and search indexes. See src/lib/cutover-redirects.ts for why there
  // are four rule groups rather than the two boundaries v1.1 §3.1 specified,
  // and why a wrong value here is expensive (301s cache hard).
  //
  // This THROWS when either destination origin is missing, so `next build` fails
  // instead of silently emitting an empty redirect list — an empty list looks
  // identical to a working one until a real visitor hits /login.
  redirects: async () =>
    buildCutoverRedirects({
      academia: process.env.NEXT_PUBLIC_ACADEMIA_URL,
      backoffice: process.env.NEXT_PUBLIC_BACKOFFICE_URL,
      self: process.env.NEXT_PUBLIC_APP_URL,
    }),
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
