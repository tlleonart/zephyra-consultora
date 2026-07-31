# `tests/cross-host/` — quarantine for multi-host e2e specs

Created at **T-fe-009 (M3)**. Nothing in this directory runs today, by design.

## What belongs here

Specs that exercise a flow spanning **more than one deployed host**. After the
app split (`domain-boundaries` v1.1 §3) the surfaces are three separate Next.js
apps with three separate origins:

| host            | serves                                       |
| --------------- | -------------------------------------------- |
| `apps/www`      | institutional public site                    |
| `apps/backoffice` | `/login`, `/admin/*` (staff CMS)           |
| `apps/academia` | `/cursos/*`, `/empresa/*` (external users)    |

A Playwright config has **one `baseURL`**. A spec that navigates from `/admin`
to `/cursos/<slug>/player` therefore cannot be expressed inside any single
workspace's harness — it needs one base URL per host. Putting such a spec in an
app's `tests/e2e/` is worse than leaving it unrun: it typechecks, it lints, it
is not CI-run, so **nothing reports it as broken** while it presents as coverage
that app does not have.

## Why this location specifically

`pnpm-workspace.yaml` declares only `apps/*` and `packages/*`, so this directory
is **not a workspace**: `turbo run test` / `lint` / `typecheck` never reach it.
It also falls outside every app's vitest `include` (`tests/unit/**`) and outside
`apps/academia`'s Playwright `testDir` (`./tests/e2e`). Verified at T-fe-009.

Consequence to be aware of: **the files here are not typechecked or linted, and
their imports (e.g. `@playwright/test`) do not resolve from the repo root.**
That is accepted for a quarantine. Whoever un-quarantines a spec owns wiring a
real harness for it.

## Current contents

- **`demo-loop.spec.ts`** — the Sprint-0 SCORM centerpiece: admin login → SCORM
  upload → ingest → publish (`apps/backoffice`) → catalog → player → SCORM 1.2
  API bridge (`apps/academia`). Two hosts. Awaiting **`T-e2e-019`** (M6 go-live
  checklist), which owns cross-host e2e — SCORM player on prod, pack purchase +
  seat invite + claim. It also needs a live Convex deploy, which is why it was
  never a CI job even before the split.

## How to un-quarantine

Not by moving a file back into an app. A cross-host harness needs, at minimum:
a Playwright project per host with its own `baseURL` (or absolute URLs derived
from `NEXT_PUBLIC_*` host vars — note `T-be-010`/M4 is what makes those host
vars exist), plus a live Convex deployment and admin credentials from secrets.
That work is `T-e2e-019`'s.
