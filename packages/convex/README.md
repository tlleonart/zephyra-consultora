# @zephyra/convex

The Convex backend — schema, functions and generated client — shared by every
app in the monorepo. Extracted from `apps/legacy/convex` by pure `git mv`, so
`git log --follow` still reaches the full history of every module.

## Public surface: exactly two entry points

```ts
import { api, internal } from "@zephyra/convex/_generated/api";
import type { Doc, Id } from "@zephyra/convex/_generated/dataModel";
```

Nothing else is importable. `package.json#exports` lists those two subpaths and
no wildcard, so **every** other specifier fails — at compile time with
`TS2307: Cannot find module` and at runtime with
`ERR_PACKAGE_PATH_NOT_EXPORTED`:

```
@zephyra/convex/lms/payment/internal   BLOCKED
@zephyra/convex/lms/payment/ledger     BLOCKED
@zephyra/convex/schema                 BLOCKED
@zephyra/convex                        BLOCKED
```

**This narrowness is a security boundary, not tidiness.** A subpath export per
module would make the money-path internals — `lms/payment/{internal,ledger,
mercadopago,checkout,email,orders,validation}` — importable from any app,
defeating the `internalMutation` trust model that gates entitlement granting: a
mutation is only trustworthy because the sole way to reach it is a Convex
function reference, never a direct import. Do not widen `exports` to "fix" an
import error. If an app needs backend behaviour, it calls a **function** through
`api`/`internal`; if it needs a type, that type belongs in `_generated/dataModel`
or in a shared types package. The cost of the narrow surface is zero, because no
app code ever needed more: the 138 call sites rewritten during the extraction
were 76 × `_generated/api` + 62 × `_generated/dataModel`, full stop.

Functions reference each other with ordinary relative paths (`../model/auth.js`)
because they are *inside* the package. So do the tests — see below.

## No build step

The two public entry points need no compilation: `_generated/api.js` is already
plain ESM (`export const api = anyApi`) and `_generated/dataModel` is types-only,
so every import of it is elided by the consumer's transpiler. Consuming Next apps
therefore need **no** `transpilePackages` entry, and this package has no `build`
script — `turbo.json` wires `typecheck` to `^typecheck` for exactly this
source-exported case.

## Commands

Run from this directory (`pnpm --filter @zephyra/convex <script>`):

| Script | What |
| --- | --- |
| `convex:dev` | `convex dev` — watch, push functions, regenerate `_generated`. |
| `codegen` | `convex codegen` — regenerate `_generated` + typecheck functions. |
| `typecheck` | `tsc -p tsconfig.json` over `convex/**` + `tests/**`. |
| `test` | `vitest run` — the 18 backend suites. |
| `lint` | `eslint .` |

**The CLI must run from HERE, not from `apps/legacy`.** `convex dev`/`codegen`
resolve `./convex` and read `CONVEX_DEPLOYMENT` from the *cwd*'s `.env.local`.
See `.env.local.example`; the deployment must match the one `apps/legacy`
points `NEXT_PUBLIC_CONVEX_URL` at.

`convex:dev` is deliberately **not** named `dev`: `turbo run dev` would then
start the Convex watcher alongside `next dev` as a silent behaviour change.
Run it as its own process, as before the extraction.

## Tests

The 18 suites moved here with the backend and kept their original directory
depth (`tests/unit/convex/{lms,model}/`), which is why their import lines are
byte-identical to before the move: `../../../../convex/lms/seats` resolved to
`apps/legacy/convex/lms/seats` and now resolves to
`packages/convex/convex/lms/seats`. The redundant-looking `convex/` segment
buys a **zero-diff** move of the suites carrying the LMS-3 money-path release
gates (`S3.9(a)`–`(e)`), which was worth more than a tidier path.

Tests may import internals freely — they run inside the package and do not go
through `exports`.

`tests/setup.ts` seeds only `MAGIC_LINK_HMAC_KEY`, which
`convex/model/passwords.ts` caches in module scope at first use. Everything else
the suites touch (`MP_*`, `EMAIL_*`, `CONVEX_SITE_URL`, `ZEPHYRA_PUBLIC_URL`)
they assign themselves — which is why they pass under turbo's `strict` env mode
without being declared in `turbo.json`. Adding a suite that *reads* a new env var
without setting it means declaring it on the `test` task there, or it silently
arrives `undefined`.

## Two tsconfigs, on purpose

- `tsconfig.json` — the monorepo's view: shared options from
  `tsconfig.base.json`, covering `convex/**` *and* `tests/**`. Used by the
  `typecheck` task.
- `convex/tsconfig.json` — **Convex-CLI-owned**, generated. Describes the Convex
  V8 runtime and is what `convex dev`/`codegen` typecheck against. Do not merge
  them.
