#!/usr/bin/env node
/**
 * convex-identity — keep the Convex deployment identity consistent across the
 * monorepo's gitignored .env.local files (V18).
 *
 * THE PROBLEM. The Convex CLI resolves both the functions directory and its
 * credentials relative to the CURRENT WORKING DIRECTORY, so `convex dev` /
 * `convex codegen` read CONVEX_DEPLOYMENT from packages/convex/.env.local. Each
 * Next app, separately, reads NEXT_PUBLIC_CONVEX_URL from its OWN .env.local
 * (Next.js does not read a monorepo-root env file). The identity is therefore
 * duplicated across FOUR files:
 *
 *   packages/convex/.env.local   CONVEX_DEPLOYMENT (+ the URLs, for cross-check)
 *   apps/academia/.env.local     NEXT_PUBLIC_CONVEX_URL (+ CONVEX_DEPLOYMENT)
 *   apps/backoffice/.env.local   NEXT_PUBLIC_CONVEX_URL
 *   apps/www/.env.local          NEXT_PUBLIC_CONVEX_URL
 *
 * When they drift, an app talks to one backend while functions are pushed to
 * another. Nothing errors. Queries just return data from the wrong deployment,
 * or return nothing at all and look like a seeding problem.
 *
 * WHY A SCRIPT AND NOT A SINGLE FILE. Symlinking needs a privileged shell on
 * Windows, and neither Next.js nor the Convex CLI will read a root-level env
 * file. Since .env.local is gitignored, NOTHING here is verifiable by code
 * review — which is exactly why the check has to be executable.
 *
 * USAGE
 *   pnpm convex:check   verify all four agree; exit 1 (and print a diff) if not
 *   pnpm convex:sync    propagate from packages/convex/.env.local into the apps,
 *                       preserving every other key in each file
 *
 * SOURCE OF TRUTH is packages/convex/.env.local, because that is the file
 * `npx convex dev` itself writes on first run — so the direction of propagation
 * always follows the tool, never a human's memory.
 *
 * DELIBERATELY NOT DONE: this does not touch the Convex DEPLOYMENT's env vars
 * (`convex env set`). Those are shared mutable state; changing them is an M6
 * action item, not a script's business.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The file the Convex CLI writes and reads. */
const SOURCE = path.join(ROOT, "packages", "convex", ".env.local");

/**
 * Which keys each consumer needs. An app that never builds a Convex HTTP URL
 * does not get NEXT_PUBLIC_CONVEX_SITE_URL, and only academia carries
 * CONVEX_DEPLOYMENT (it is the app whose workspace people run `convex dev` from
 * by habit) — the point is to keep what EXISTS consistent, not to spray keys.
 */
const CONSUMERS = [
  {
    file: path.join(ROOT, "apps", "academia", ".env.local"),
    keys: [
      "NEXT_PUBLIC_CONVEX_URL",
      "NEXT_PUBLIC_CONVEX_SITE_URL",
      "CONVEX_DEPLOYMENT",
    ],
  },
  {
    file: path.join(ROOT, "apps", "backoffice", ".env.local"),
    keys: ["NEXT_PUBLIC_CONVEX_URL"],
  },
  {
    file: path.join(ROOT, "apps", "www", ".env.local"),
    keys: ["NEXT_PUBLIC_CONVEX_URL"],
  },
];

/** Minimal dotenv read: `KEY=value`, ignoring blanks and `#` comments. */
const parseEnv = (text) => {
  const out = new Map();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1).trim());
  }
  return out;
};

/**
 * Replace KEY's value in place if present, else append. Every other line —
 * comments, ordering, unrelated secrets — is preserved byte for byte. This file
 * holds real credentials; rewriting it wholesale would be unacceptable.
 */
const upsert = (text, key, value) => {
  const lines = text.split(/\r?\n/);
  const idx = lines.findIndex((l) => l.trim().startsWith(`${key}=`));
  if (idx === -1) {
    const sep = text.endsWith("\n") || text === "" ? "" : "\n";
    return `${text}${sep}${key}=${value}\n`;
  }
  lines[idx] = `${key}=${value}`;
  return lines.join("\n");
};

const relative = (p) => path.relative(ROOT, p).replace(/\\/g, "/");

const mode = process.argv.includes("--sync")
  ? "sync"
  : process.argv.includes("--check")
    ? "check"
    : null;

if (!mode) {
  console.error("usage: node ops/convex-identity.mjs --check | --sync");
  process.exit(2);
}

if (!existsSync(SOURCE)) {
  // Not a failure: a fresh clone or CI has no .env.local at all, and there is
  // nothing to be inconsistent with. Drift is a local-development hazard.
  console.log(
    `convex-identity: ${relative(SOURCE)} not found — nothing to ${mode}. ` +
      `Run \`npx convex dev\` from packages/convex to create it.`
  );
  process.exit(0);
}

const source = parseEnv(readFileSync(SOURCE, "utf8"));
if (!source.has("CONVEX_DEPLOYMENT")) {
  console.error(
    `convex-identity: ${relative(SOURCE)} has no CONVEX_DEPLOYMENT. That file is ` +
      `the source of truth (it is what \`npx convex dev\` writes); fix it there.`
  );
  process.exit(1);
}

const problems = [];
const changes = [];

for (const consumer of CONSUMERS) {
  if (!existsSync(consumer.file)) {
    console.log(`convex-identity: skip ${relative(consumer.file)} (absent)`);
    continue;
  }
  let text = readFileSync(consumer.file, "utf8");
  const current = parseEnv(text);

  for (const key of consumer.keys) {
    const expected = source.get(key);
    // Only reconcile keys the source actually defines. If packages/convex does
    // not know NEXT_PUBLIC_CONVEX_SITE_URL, it is not this script's to invent.
    if (expected === undefined) continue;
    const actual = current.get(key);
    if (actual === expected) continue;

    if (mode === "check") {
      problems.push(
        `${relative(consumer.file)}: ${key}\n` +
          `    expected ${expected}\n` +
          `    actual   ${actual === undefined ? "(absent)" : actual}`
      );
    } else {
      text = upsert(text, key, expected);
      changes.push(`${relative(consumer.file)}: ${key} -> ${expected}`);
    }
  }

  if (mode === "sync") writeFileSync(consumer.file, text);
}

if (mode === "check") {
  if (problems.length > 0) {
    console.error(
      `convex-identity: DRIFT against ${relative(SOURCE)}\n\n` +
        problems.join("\n") +
        `\n\nAn app pointed at a different deployment than the one functions are ` +
        `pushed to fails SILENTLY — wrong or empty data, no error. ` +
        `Fix with: pnpm convex:sync`
    );
    process.exit(1);
  }
  console.log(
    `convex-identity: OK — deployment ${source.get("CONVEX_DEPLOYMENT")} ` +
      `consistent across every present .env.local`
  );
  process.exit(0);
}

if (changes.length === 0) {
  console.log("convex-identity: already in sync, nothing written");
} else {
  console.log(`convex-identity: synced\n  ${changes.join("\n  ")}`);
}
