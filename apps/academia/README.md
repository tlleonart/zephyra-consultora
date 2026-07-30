# @zephyra/academia

**Academia Zephyra** — the product surface for **external users**: learners
(B2C), Org Admins and org learners (B2B). Target host
`academia.zephyraconsultora.com`.

Populated at **T-fe-008** from `apps/legacy` per
`domain-boundaries-2026-07-27.md` v1.1 §3 / §3.1.

## Route tree — today's tree, VERBATIM

The paths are unchanged from the pre-split app; only the **host** moves
(boundaries v1.1 §3.1, ruled 2026-07-28). No renames, no internal-link sweep.

```
(public)/cursos                      B2C catalog
(public)/cursos/[slug]               course detail
(public)/cursos/[slug]/player        SCORM player (+ its own full-viewport layout)
(public)/cursos/[slug]/compra/{exito,error,pendiente}   MercadoPago B2C callbacks
(public)/cursos/auth/{signup,signin,verify,set-password,recovery}
(public)/cursos/privacidad
(empresa)/empresa                    Org Admin console
(empresa)/empresa/cursos{,/[slug]}   B2B pack catalog / detail
(empresa)/empresa/registro{,/crear}  org self-signup
(empresa)/empresa/invitacion         seat claim
(empresa)/empresa/compra/{exito,error,pendiente}        MercadoPago B2B callbacks
api/lms/asset/[slug]/[...path]       SCORM asset proxy  <-- MUST stay in this app
```

`/cursos` keeps its prefix on purpose. Course slugs are auto-derived from CAMPUS
titles with **no reserved-word guard**, so root-level slugs could silently
collide with static routes (a course titled "Empresa" would lose to `/empresa`
and become unreachable, with no error). The prefix makes that class of collision
impossible — see boundaries §3.1 D1. `/cursos/mis-cursos` is **not** in the
middleware matcher: the page never existed, so the entry gated a 404.

## Two load-bearing premises live in this app

**1 — SCORM same-origin triple coupling.** The player page, the asset proxy
(`/api/lms/asset/*`) and the `session-learner` cookie must share one host.
CAMPUS content walks `window.parent` and calls
`window.parent.document.querySelectorAll('iframe')`; a cross-origin iframe
blocks both and the bridge dies **silently** (content renders, progress stops
persisting). `ScormPlayer.tsx` therefore builds a **relative** asset URL and the
iframe keeps `sandbox="allow-scripts allow-same-origin"`. Guarded by
`tests/unit/app/asset-proxy-same-origin.test.ts` (static) **and** by ci.yml's
`build` job, which greps this app's `routes-manifest.json` for the proxy route.

**2 — auth separation.** Only the **learner** session exists here:
`session-learner` cookie, `LEARNER_JWT_SECRET`, host-only (`httpOnly`, `secure`
in production, `sameSite=lax`, **no `Domain=`**). There is no `SESSION_SECRET`
in this app's env and no admin verify path in its middleware bundle, so an admin
cookie grants nothing on this host by construction. `src/middleware.ts` verifies
the learner JWT **inline** — it cannot import
`features/auth-learner/lib/session.ts` (Edge runtime; that module imports
`next/headers`), and its dev fallback secret **must stay identical** to the one
in `session.ts` or freshly-minted learners bounce to sign-in.

## Money path

`features/lms-checkout`, `features/packs`, `features/seats` and both `compra/*`
callback trees are MercadoPago surfaces. They were moved with **zero logic
change**. MercadoPago `back_urls` are still the pre-split hardcoded values —
retargeting them is `T-be-010` (M4), not this app's concern yet.

## Scripts

`dev` · `build` · `start` · `lint` · `typecheck` · `test` · `test:watch` ·
`test:e2e` · `test:e2e:ui`. All four CI tasks are declared, so
`turbo run lint typecheck test build` **executes** this workspace instead of
silently skipping it.

`typecheck` runs against the hermetic `tsconfig.typecheck.json` (drops
`.next/types/**`) so it shares no file with `build` — see that file's header.

## Env

Build `.env.local` from `.env.local.example`, which was written variable by
variable. **Do not copy `apps/legacy/.env.local` wholesale**: that is how
`apps/backoffice` silently inherited `LEARNER_JWT_SECRET` at T-fe-007, invisibly,
because `.env.local` is gitignored. `SESSION_SECRET` must never appear here.
