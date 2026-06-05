# ADR-0001 — Extend `zephyra-consultora` with the LMS; ratify the Next.js + Convex + Nodemailer stack

- **Status:** Accepted
- **Date:** 2026-06-03
- **Sprint:** SPRINT-ZEPHYRA-LMS-0 (`specs/008-zephyra-lms-foundation`)
- **Supersedes:** the original greenfield direction (Payload CMS 3 + Postgres +
  Cloudflare R2), rejected at PDD v1.2.

## Context

Zephyra needs a self-managed e-learning platform (LMS) that sells and delivers
SCORM 1.2 corporate-training courses produced by an upstream AI content provider
("CAMPUS"). The first instinct (PDD v1.0/v1.1) was a greenfield build on a new
stack and a new repository.

A premise-drift review against the actual filesystem corrected this: the
`zephyra-consultora` repository already runs in production for Zephyra's
institutional site and admin CMS, and it already provides every capability the
LMS chassis needs — a Next.js 15 App Router application, a Convex backend with
database + reactive queries + object storage, JWT custom authentication, and a
wired Vercel + Convex Cloud deploy pipeline. Standing up a parallel stack would
duplicate all of this and fracture Zephyra's operations.

## Decision

**Extend the existing `zephyra-consultora` repository with the LMS, and ratify
its established stack as the LMS stack.** No new repository, no new data layer,
no new tooling. The ratified stack:

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 (App Router) + React 19 + TypeScript 5.7 |
| Backend / data | Convex 1.17 (functions + database + reactive queries) |
| Object storage | Convex `_storage` (per-file, served via `getUrl(storageId)`) |
| Auth | JWT custom with `jose` 5.9 signed cookies, route protection in `middleware.ts` |
| SCORM runtime | `scorm-again` v3.x (the one new dependency Sprint 0 adds) |
| Email | Nodemailer 8 + `@react-email/components` (Resend-compatible templates) |
| Hosting | Vercel (Next.js) + Convex Cloud (DB + storage + functions) |
| Testing | Vitest 2.1 + Playwright 1.49 |

> Note on email: the PDD references the email layer as "Resend"; the repository
> currently sends via **Nodemailer 8** with Resend-compatible React Email
> templates. The template layer is provider-agnostic, so the sender can be
> swapped back to a hosted provider later without touching templates. This ADR
> ratifies the layer as it exists in the codebase today.

## Rationale

1. **No new repository.** The institutional site and the LMS share a brand, a
   domain, an admin surface, and an operations team; one repository keeps them
   coherent and avoids a second deploy pipeline to maintain.
2. **No new data layer.** Convex already covers database, reactive queries, and
   object storage in a single platform. Adding Postgres + a separate object
   store (the rejected Payload/R2 direction) would duplicate the data layer and
   the admin UI for no functional gain.
3. **Reuse Convex `_storage` for SCORM content.** The provider ships ~29 MB
   SCORM packages; the Sprint 0 spike proved client-side unzip → per-file upload
   to `_storage` → manifest parse is viable at that volume, so no external object
   store is needed.
4. **Reuse the existing JWT auth.** The `jose`-based signed-cookie auth is in
   production and protects `/admin`. The LMS reuses it for the admin/operator
   audience as-is; the learner audience (Sprint 1) reuses the same pattern with a
   separate cookie and signing key. This is why a new auth-library ADR (ADR-0003)
   was dropped — there is no open decision.
5. **Reuse the existing deploy pipeline.** Vercel previews and Convex Cloud are
   already wired; the LMS inherits CI/CD and preview deploys with zero new
   infrastructure.
6. **Saves roughly a sprint of bootstrapping.** Reusing the established chassis
   lets Sprint 0 spend its budget on the actual risk (the SCORM player spike)
   instead of re-deriving a stack that already works in production.

## Consequences

- **Positive:** minimal new surface area; operational and brand coherence; the
  sprint focuses on de-risking the SCORM assumption rather than bootstrapping;
  one deploy pipeline, one auth system, one storage layer to operate.
- **Constraint:** LMS code must coexist cleanly with the institutional site in
  one repo and one Convex schema. The namespacing and isolation rules that make
  this safe are recorded in [ADR-0004](./0004-lms-as-feature-track-not-separate-repo.md).
- **Constraint:** the institutional site must never regress. Schema changes are
  additive; the LMS lives behind its own route groups (`/cursos`, `/admin/lms`).
- **Rejected alternatives:** Payload CMS 3 + Postgres + Cloudflare R2 (second
  data layer, duplicate admin UI, broken operational coherence — rejected at PDD
  v1.2); Better-Auth / Lucia as a new auth library (existing `jose` pattern works
  and is in production — rejected, see ADR-0003 dropped).

## Note (2026-06-05, F01) — email stack clarification

The email layer is **Nodemailer + Ferozo SMTP**, not Resend. The
`RESEND_API_KEY` placeholder in `.env.local.example` was an orphan from a
prior PDD draft and has been removed in Sprint 1 / F01. Templates are
React Email (`@react-email/components`), which would be Resend-compatible
if the SMTP transport is later swapped to a hosted provider — but that
swap is out of V1 scope. Code references: `src/lib/mailer/learner.ts`,
`src/features/auth/actions/password-reset.ts`, `src/app/api/send-mail/route.ts`.
