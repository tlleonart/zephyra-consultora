import { dirname } from "path";
import { fileURLToPath } from "url";
import { nextEslintConfig } from "../../eslint.config.base.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Deliberately the SAME baseline the code was linted under before the move.
// These files lived in apps/legacy and were covered by its `eslint .`, i.e. by
// nextEslintConfig — including its `convex/_generated/**` ignore, which resolves
// against this workspace and so still matches the generated client. Reusing the
// function verbatim means the extraction changes zero lint rules; a leaner
// backend-only config would have been a second, unreviewed change riding along
// with a move. The react/web-vitals rules in the baseline simply never match
// backend code.
// Named rather than an inline array literal: the baseline's
// `import/no-anonymous-default-export` (from next/core-web-vitals) warns on
// `export default [...]`.
const config = [
  ...nextEslintConfig(__dirname),
  {
    rules: {
      // The ONLY rule delta from the shared baseline, and it is a false
      // positive rather than a relaxation: `no-html-link-for-pages` resolves a
      // Next.js `pages/` (or `src/pages/`) directory to decide whether an <a>
      // should have been a <Link>. A Convex backend package has neither a pages
      // directory nor any JSX, so the rule can never fire here — it only prints
      // "Pages directory cannot be found ..." on every single lint run,
      // including in CI. Off, so a genuine finding is never buried in noise.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
];

export default config;
