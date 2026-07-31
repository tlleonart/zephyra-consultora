# @zephyra/www

The institutional marketing site. Target host **`www.zephyraconsultora.com`**
(the apex is canonical — see `domain-boundaries` §3.1).

Populated from `apps/legacy` per `domain-boundaries` v1.1 §3. **Moved, not
redesigned:** no visual change was made, no component was restyled, and the
`(public)` route group name was kept so that every `@/app/(public)/…` CSS-module
import kept resolving without an edit.

## What lives here

| Surface | Notes |
|---|---|
| `(public)/page.tsx` | `/` — home |
| `(public)/blog`, `(public)/blog/[slug]` | `/blog`, `/blog/[slug]` |
| `(public)/proyectos`, `(public)/proyectos/[slug]` | `/proyectos`, `/proyectos/[slug]` |
| `(public)/contacto` | `/contacto` |
| `(public)/error.tsx`, `(public)/not-found.tsx` | the route group's error + 404 |
| `app/layout.tsx` | own root layout: fonts, `ConvexProvider`, `ToastProvider` |
| `api/send-mail` | contact form → Resend, with legacy SMTP fallback |
| `components/public/*` | **except `CourseCard`**, which is Academia's |
| `lib/staticImages.ts` | static image fallbacks for team/clients/projects |

## What deliberately does NOT live here

**No authentication and no middleware.** `domain-boundaries` §4: "www carries no
auth at all." There is no `middleware.ts`, no `jose`, no session/JWT/cookie code
and no `SESSION_SECRET` / `LEARNER_JWT_SECRET` reference — and `next build`
emits an empty middleware manifest. If a change here appears to need a session,
it belongs in `apps/academia` or `apps/backoffice` instead.

Also absent: `CourseCard`, `(public)/cursos/*`, `(empresa)/*`, `(auth)/`,
`(dashboard)/`, and the SCORM asset proxy.

## Scripts

`dev` · `build` · `start` · `lint` · `typecheck` · `test`.

Declaring all of them is load-bearing, not boilerplate. **turbo silently skips a
workspace for any task it does not define** — while every CI job still reports
green. The stub this app replaced declared no scripts at all, so populating it
without adding them would have landed an entire app that CI never checked. When
adding `apps/backoffice` / `apps/academia`, declare the scripts in the same
change as the code and confirm the workspace is *named* in the `turbo run`
output rather than trusting a green summary.

`test` is `vitest run --passWithNoTests`. This app has **no tests today**: none
of the 27 test files in the repo covered the marketing surface inside
`apps/legacy` either, so none were moved and none were invented. The flag is
honest about that (vitest reports "No test files found") rather than a stubbed
`exit 0`, and it still fails if a test file is added and breaks. Verification
here comes from `lint` + `typecheck` + `build`.

## Config notes

- **`transpilePackages: ["@zephyra/ui", "@zephyra/utils"]` is required.** Both
  are source-exported (`.tsx` + CSS Modules), so Next must run them through its
  own SWC/CSS pipeline. `@zephyra/convex` is deliberately absent — its entry
  points need no compilation. The rule is per-package; the convex "not needed"
  conclusion does not transfer.
- **`tsconfig.typecheck.json`** exists for the same reason as in `apps/legacy`:
  it drops `.next` so `typecheck` is hermetic and cannot race `build` inside one
  workspace. Do *not* "fix" the ordering by adding an un-carated same-package
  `"build"` to `turbo.json`'s `typecheck` task — that was tried and failed CI.
- **`next build` needs `NEXT_PUBLIC_CONVEX_URL`** even though nothing is fetched
  at build time. Every page is `force-dynamic`, but the root layout mounts
  `ConvexProvider`, which constructs a `ConvexReactClient` at **module scope**;
  without the var, page-data collection throws "Client created with undefined
  deployment address". Any syntactically valid URL is enough (CI passes a
  placeholder).
- **Design tokens.** The root layout imports `@zephyra/ui/styles/globals.css`,
  which `@import`s `variables.css`. That chain is per-app and must be present in
  each new app — it is what puts `--color-brand-main: #1E3C2E` in the served CSS.
- **Hardcoded absolute URLs are left alone on purpose.** Per-app
  `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` and the canonical host sweep are
  a separate task (M4).

## Formerly shared with `apps/legacy` (retired at T-fe-009)

`(public)/layout.tsx` (+ its CSS), `(public)/error.tsx`, `(public)/not-found.tsx`,
`components/public/Navbar`, `components/public/Footer` and `public/images/` were
**copied** here, not moved, because `apps/legacy` still served
`(public)/cursos/*` from the same route group and still referenced `/images/*`
at the time. Everything else was `git mv`'d, so `git log --follow` traces the
full history.

`apps/legacy` was deleted at **T-fe-009**, and its copies went with it — nothing
was left to reconcile. Verified before the deletion: all 22 files under
`apps/legacy/public/images/` were byte-identical to the copies here (two of them
also live in `apps/academia`), and `src/app/layout.tsx` was byte-identical
across all four apps (sha256 `33d6c15f…`). No asset was orphaned.
