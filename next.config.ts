import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lint is a dedicated CI job (`npm run lint`) and a separate local step, not a
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
