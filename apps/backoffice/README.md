# @zephyra/backoffice

The staff-only admin surface. Target host **`backoffice.zephyraconsultora.com`**.

Populated from `apps/legacy` per `domain-boundaries` v1.1 §3. **Moved, not
redesigned:** no visual change was made, no component was restyled, and the
`(auth)` / `(dashboard)` route group names were kept so that every `@/…` import
kept resolving without an edit (`paths` is per-workspace). The blue→green token
remap is M5's job, not this app's.

## What lives here

| Surface | Notes |
|---|---|
| `(auth)/login`, `forgot-password`, `reset-password` | credential login + password reset |
| `(dashboard)/admin` | dashboard home (stats) |
| `(dashboard)/admin/{blog,team,projects,services,service-blocks,clients,alliances,newsletter}` | the institutional CMS |
| `(dashboard)/admin/users` | staff user management |
| `(dashboard)/admin/trash` | soft-delete restore — spans institutional **and** LMS tables |
| `(dashboard)/admin/lms/*` | course list, SCORM upload, course edit (staff-side LMS authoring) |
| `api/auth/session` | session read endpoint |
| `features/*` | `auth`, `blog`, `clients`, `alliances`, `projects`, `services`, `team`, `users`, `newsletter`, `trash`, `dashboard` |
| `components/layout/{AuthLayout,DashboardLayout}` | the two chrome shells |
| `middleware.ts` | **admin branch only** |

Two entries look like Academia's but are not, by design (boundaries §3 "Resolved
ambiguities"): `/admin/lms/*` is *staff managing courses* (SCORM ingest, pricing,
metadata), and `/admin/trash` restores rows from both institutional and LMS
tables. Neither is a mistake and neither should be "corrected" later.

## What deliberately does NOT live here

No learner code at all: no `auth-learner`, no `session-learner`, no
`LEARNER_JWT_SECRET`, no `lms-checkout` / `consent` / `org-signup` /
`org-dashboard` / `seats` / `packs`, no `CourseCard`, no SCORM asset proxy and no
SCORM player. Those are Academia's (`T-fe-008`). No `(public)/` marketing routes
either — those are `apps/www`'s.

## Security boundary

- The `session` cookie is **host-only**: `httpOnly`, `secure` in production,
  `sameSite: 'lax'`, and **no `Domain=`**. It is scoped to this host and must
  never be widened to `.zephyraconsultora.com` — there is deliberately no SSO
  between the three apps (boundaries §4).
- `SESSION_SECRET` resolution in `features/auth/lib/session.ts` is **lazy and
  fails closed in production**. Do not make it eager and do not supply a
  production placeholder.
- The middleware contains only the admin branch, so an admin session cannot
  reach a learner-protected route by construction — the learner verify path does
  not exist in this bundle.

## Dependencies — derived from the moved files' imports

Kept because something here imports it: the ten `@tiptap/*` packages (the
`WysiwygEditor` behind the blog editor — `@tiptap/pm` is the required ProseMirror
peer, pulled in transitively rather than by a direct import), `jose` (admin
session signing + middleware verify), `jszip` (client-side SCORM package
inspection in `ScormUploadForm`), `nodemailer` + `resend` (password-reset mail),
`convex`, `next`, `react`, `react-dom` and the three workspace packages.

Dropped because nothing here imports it: `hash-wasm` and `scorm-again` (SCORM
player — Academia), `@react-email/components` (`src/emails/*` stays in legacy
and moves to Academia), `@playwright/test` (no e2e specs in this app).

## Scripts

`dev` · `build` · `start` · `lint` · `typecheck` · `test`. All four gate tasks
are declared so turbo actually **executes** this workspace instead of silently
skipping it. `test` is `vitest run --passWithNoTests`: none of the repo's 27 test
files covered the admin CMS inside `apps/legacy`, so none were moved and none
were invented — the flag says so out loud rather than faking a passing suite,
and it goes red the moment a real test is added and breaks.

## Env

See `.env.local.example`.
