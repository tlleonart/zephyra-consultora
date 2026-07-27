import { dirname } from "path";
import { fileURLToPath } from "url";
import { nextEslintConfig } from "../../eslint.config.base.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Deliberately the SAME baseline this code was linted under before the move:
// cn.ts lived in apps/legacy/src/lib and was covered by its `eslint .`, i.e. by
// nextEslintConfig. Reusing the function verbatim means the extraction changes
// zero lint rules. The react/web-vitals rules in the baseline simply never
// match a framework-agnostic helper.
// Named rather than an inline array literal: the baseline's
// `import/no-anonymous-default-export` (from next/core-web-vitals) warns on
// `export default [...]`.
const config = [
  ...nextEslintConfig(__dirname),
  {
    rules: {
      // Same false positive documented in packages/convex/eslint.config.mjs:
      // `no-html-link-for-pages` resolves a Next.js `pages/` directory to decide
      // whether an <a> should have been a <Link>. This package has neither a
      // pages directory nor any JSX, so the rule can never fire — it only prints
      // "Pages directory cannot be found ..." on every lint run, including CI.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
];

export default config;
