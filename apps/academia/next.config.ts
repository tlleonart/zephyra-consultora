import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Same reason as apps/legacy and apps/www: this app is nested inside a pnpm
  // workspace, so Next's workspace-root heuristic (walk up looking for a
  // lockfile) can land outside the checkout and trace the wrong tree. Pin it to
  // the monorepo root explicitly.
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
  transpilePackages: ["@zephyra/ui", "@zephyra/utils"],
  // Lint is a dedicated CI job (`pnpm turbo run lint`), not a build-time gate —
  // mirrors apps/legacy and apps/www so the pre-existing lint debt does not
  // couple into every build.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Course cover images are served from Convex `_storage` signed URLs.
  //
  // NOTE — this allow-list is for next/image ONLY. It has nothing to do with
  // the SCORM asset proxy: package assets MUST be served from this app's own
  // origin via /api/lms/asset/[slug]/[...path], never from *.convex.cloud,
  // because the CAMPUS content walks `window.parent` (and calls
  // window.parent.document.querySelectorAll) to find the LMS API. A
  // cross-origin iframe kills that bridge SILENTLY — content still renders and
  // progress stops persisting. See src/app/(public)/cursos/[slug]/player/
  // ScormPlayer.tsx and tests/unit/app/asset-proxy-same-origin.test.ts.
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
