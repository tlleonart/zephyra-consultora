import { dirname } from "path";
import { fileURLToPath } from "url";
import { nextEslintConfig } from "../../eslint.config.base.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Deliberately the SAME baseline these components were linted under before the
// move: they lived in apps/legacy/src and were covered by its `eslint .`, i.e.
// by nextEslintConfig (next/core-web-vitals + next/typescript). Reusing the
// function verbatim means the extraction changes zero lint rules — a leaner
// config would be a second, unreviewed change riding along with a move.
// Named rather than an inline array literal: the baseline's
// `import/no-anonymous-default-export` (from next/core-web-vitals) warns on
// `export default [...]`.
const config = [
  ...nextEslintConfig(__dirname),
  {
    rules: {
      // The ONLY rule delta from the shared baseline, and it is a false positive
      // rather than a relaxation — the same one already documented in
      // packages/convex/eslint.config.mjs, for the same reason.
      //
      // `no-html-link-for-pages` needs a Next.js route root (`pages/` or `app/`)
      // to decide whether an <a href="/x"> should have been a <Link>.
      // apps/legacy satisfies it with src/app; a component package has neither,
      // so the rule cannot resolve any route and only prints
      // "Pages directory cannot be found at .../packages/ui/pages or
      // .../packages/ui/src/pages" on every lint run, including in CI. Off, so a
      // genuine finding is never buried in noise.
      //
      // Unlike packages/convex this package DOES contain JSX, so the disable was
      // checked rather than assumed: `grep -rnE "<a[ >]|next/link" src/` returns
      // NOTHING — there is no anchor element and no next/link import anywhere in
      // the package, so the rule has nothing to check here even in principle. If
      // a component ever gains a link, re-enable this and give the rule a
      // `pagesDir`/`rootDir` instead of leaving it off.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
];

export default config;
