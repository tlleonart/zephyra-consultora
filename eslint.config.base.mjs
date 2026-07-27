import { FlatCompat } from "@eslint/eslintrc";

/**
 * Shared ESLint baseline for every Next.js workspace in the monorepo.
 *
 * This is the exact config the single-app eslint.config.mjs carried before the
 * split (same ignores, same `next/core-web-vitals` + `next/typescript`
 * extends, same FlatCompat mechanism) — lifted verbatim so the future
 * www/backoffice/academia apps inherit it instead of re-deriving it. No rule
 * was added, removed or retuned while moving.
 *
 * `baseDirectory` is a parameter rather than this file's own dirname on
 * purpose: FlatCompat resolves the extended shareable configs relative to it,
 * and under pnpm's strict hoisting `eslint-config-next` lives in the
 * *consuming* workspace's node_modules, not the repo root's. Each app passes
 * its own directory.
 *
 * @param {string} baseDirectory - the consuming workspace's directory.
 * @returns {import("eslint").Linter.Config[]}
 */
export function nextEslintConfig(baseDirectory) {
  const compat = new FlatCompat({ baseDirectory });

  return [
    {
      ignores: [
        ".next/**",
        "out/**",
        "build/**",
        "next-env.d.ts",
        "convex/_generated/**",
        "node_modules/**",
      ],
    },
    ...compat.extends("next/core-web-vitals", "next/typescript"),
  ];
}
