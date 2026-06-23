# Feature Specification: Zephyra LMS — Foundation (Sprint 0)

**Branch**: `feature/008-zephyra-lms-foundation` | **Date**: 2026-06-03 | **Sprint**: SPRINT-ZEPHYRA-LMS-0
**Input**: PDD v1.3 + SDD v3 (canonical), Sprint plan v3

## Resumen

Sprint 0 es el sprint de fundación del LMS de Zephyra. NO es greenfield: extiende el repo de producción `zephyra-consultora` (Next.js 15 + Convex + JWT custom con `jose` + Nodemailer), que ya sirve el sitio institucional + CMS admin (specs 001–007 ya shippeadas).

El sprint prueba la apuesta técnica central del PDD: que un paquete SCORM 1.2 producido por el proveedor (CAMPUS) puede ingestarse (unzip en el browser → upload por archivo a Convex `_storage` → parseo de manifest) y reproducirse en un iframe sandboxeado, con `scorm-again` puenteando las llamadas SCORM hacia mutations de Convex que persisten eventos (`lmsScormEvents`) y proyectan el agregado (`lmsEnrollments`).

Esta Fase A entrega únicamente la **fundación**: branch, scaffolding de specs, dependencias, subset de schema `lms*`, route groups, middleware, y navegación admin. El spike SCORM en sí (centerpiece) es Fase D.

## Alcance de Fase A (este documento)

### En alcance
- Branch `feature/008-zephyra-lms-foundation` cortado de `main`.
- Carpeta `specs/008-zephyra-lms-foundation/` con la convención de 6 archivos (igual que specs 001–007).
- Dependencias nuevas: `scorm-again` (bridge SCORM) + librería de unzip en browser (JSZip).
- Subset de schema `lms*` para el spike: `lmsCourses`, `lmsScormEvents`, `lmsEnrollments` con sus índices (PDD §6.3).
- Stubs de funciones Convex bajo `convex/lms/`.
- Route groups: `(public)/cursos/...` y `(dashboard)/admin/lms/...`.
- Protección de `/admin/lms/*` vía el middleware de admin existente.
- Navegación admin actualizada con la sección LMS junto a los 10 sub-routes existentes.

### Fuera de alcance (fases posteriores o sprints futuros)
- El spike SCORM completo (ingest + player + bridge + proyección) — Fase D.
- CI workflow (`.github/workflows/ci.yml`) — Fase C.
- ADRs — Fase F.
- Set completo de tablas `lms*` (seats, orders, payments, customers, etc.) — Sprint 1.
- Auth de learner (`session-learner` cookie, magic-link, tabla `lmsCustomers`) — Sprint 1 (solo documentado aquí).

## Requisitos funcionales (Fase A)

- **FR-A01**: El repo debe tener una rama de feature aislada cortada de `main`. NO se mergea a `main` en este sprint (Tomás testea; el equipo de ingeniería ejecuta el merge tras su confirmación).
- **FR-A02**: La documentación de especificación debe seguir la convención existente del repo (spec-kit, 6 archivos markdown).
- **FR-A03**: El schema de Convex debe extenderse de forma **aditiva** con el subset `lms*`; las 11 tablas institucionales quedan intactas.
- **FR-A04**: La superficie de rutas debe escalar a dos audiencias: pública (`/cursos`) y admin (`/admin/lms`).
- **FR-A05**: La sección admin del LMS debe estar protegida por la misma autenticación que el resto de `/admin`.
- **FR-A06**: El admin debe poder ver la sección LMS en la navegación lateral.

## Criterios de aceptación (binarios)

Ver `tasks.md` para el desglose por tarea (T-ZL0-A01, T-ZL0-A02) con sus ACs verificables.

## Disciplina de regresión (HARD)

Este es un codebase de producción. Cualquier cambio de schema/ruta/nav que rompa el sitio institucional (`/`, `/blog`, `/proyectos`, `/contacto`, `/admin`) debe revertirse y aislarse. El cambio de schema es **aditivo** y todas las tablas LMS llevan prefijo `lms*`.

---

# Sprint 1 — Hardening + Learner identity + Catálogo público + Admin LMS

**Branch**: `feature/008-zephyra-lms-foundation` (continúa) | **Date**: 2026-06-05 | **Sprint**: SPRINT-ZEPHYRA-LMS-1
**Plan canónico**: `sprint-plan-SPRINT-ZEPHYRA-LMS-1-v1.md` (en el directorio de outputs del orquestador del sprint)
**SDD**: `sdd-zephyra-lms-sprint-1-2026-06-04.md` (en el directorio de outputs del equipo de producto)

Sprint 1 EXTIENDE Sprint 0 sin reemplazarlo: el sitio institucional, el subset SCORM del spike (Fase D) y la convención de namespace `lms*` permanecen intactos. Las nuevas tablas (`lmsCustomers`, `lmsMagicLinkTokens`) son aditivas; toda mutación queda fuera de la superficie pública hasta que pasen los gates de QA.

## Capacidades Sprint 1 (S1.1 – S1.8)

- **S1.1 — Hardening de auth admin**: migración perezosa de hashes (bcrypt/legado → argon2id OWASP 2024) sin romper sesiones activas, cookie `session` rotada en cada login. Sin downtime ni reset masivo.
- **S1.2 — Identidad de learner**: tabla `lmsCustomers` (individual / org_admin / org_learner), cookie `session-learner` independiente (distinto secreto JWT), magic-link como path primario, password opcional.
- **S1.3 — Magic-link end-to-end**: tabla `lmsMagicLinkTokens` con `tokenHash` HMAC-SHA-256, single-use, TTL 30min activación / 15min signin+recovery, tres `purpose` (`learner_activation`, `learner_signin`, `learner_recovery`). Email de envío vía proveedor existente (Resend en hardening, swappeable).
- **S1.4 — Catálogo público de cursos**: `/cursos` + `/cursos/[slug]` reactivos sobre `lmsCourses.status = "published"`, SEO básico (metadata + sitemap entry), responsive móvil/desktop.
- **S1.5 — Admin LMS — catálogo**: ABM de `lmsCourses` desde `/admin/lms` reutilizando los patrones del CMS institucional (TipTap para descripción, soft-delete consistente).
- **S1.6 — Admin LMS — learners**: vista read-only de `lmsCustomers` con filtros por `type` / `organizationId`, búsqueda por email; sin mutaciones destructivas hasta Sprint 2.
- **S1.7 — Habeas Data v1**: endpoint admin-only para soft-delete de `lmsCustomers`; el actor registrado en `deletedBy` siempre es un `adminUsers` (mitigación H-2 del PDD — los learners nunca aparecen como `deletedBy`).
- **S1.8 — Observabilidad mínima**: contadores de magic-link emitido/consumido/expirado expuestos como query Convex, log estructurado de fallos de consume (token expirado vs. ya usado vs. no encontrado).

## Fuera de alcance Sprint 1

- Pagos y seats reales (`lmsOrders`, `lmsPayments`, `lmsSeatPacks`, `lmsSeats`) — Sprint 2.
- Organizaciones reales (`lmsOrganizations`) — Sprint 3. El campo `organizationId` en `lmsCustomers` queda como `string` placeholder hasta entonces.
- Revenue share / payouts — Sprint 4.
- Migración de fixture SCORM a contenido del proveedor (CAMPUS) — fuera de scope LMS-internal.

---

## Sprint 1 — Close summary (2026-06-05)

All build phases shipped behind the `feature/008-zephyra-lms-foundation`
branch. Phase F01 (this document update) is the last task before sprint
close.

### Capability outcomes (S1.1 – S1.8)

- **S1.1 — Public catalog** (E01 + E02). `/cursos` lists `lmsCourses` filtered
  by `status = "published"`; `/cursos/[slug]` renders the detail page with the
  CTA stub. SEO metadata and responsive layout shipped. See commits
  `106ce6d` / `2b51c64`.
- **S1.2 — Admin ingestion polish** (E03). Manifest validation hardened
  (rejects malformed `imsmanifest.xml` with a structured error); duplicate
  ingest archives the prior course instead of overwriting. Closes the two
  Sprint-0 carry-forward spec drifts on the ingestion path. Backed by
  [ADR-0006](../../docs/decisions/0006-ingest-scorm-package-as-convex-action.md).
  Commits `092b1b2` / `ec7ae9f`.
- **S1.3 — Learner auth** (C01 + C02 + C03 + C04). Backend (`convex/lms/auth.ts`)
  + magic-link email template + signup/signin/verify/set-password UI
  (`src/features/auth-learner/*`) + middleware extension. Distinct cookie
  (`session-learner`) and signing key (`LEARNER_JWT_SECRET`). Locked into
  [ADR-0007](../../docs/decisions/0007-learner-auth-magic-link-plus-password.md).
  Commits `6265e8f`, `e7ad7ca`, `02e29f4`, `eca26ed`.
- **S1.4 — Player full** (D01 + D02). D01 migrated the Sprint-0 placeholder
  enrollment to a real `lmsEnrollments` row keyed by `Id<"lmsCustomers">` and
  added the admin issue-enrollment flow. D02 added multi-SCO navigation,
  cross-session resume, and `progressPercent` aggregation across SCOs. Commits
  `bb582bd`, `a953644`.
- **S1.5 — Test infrastructure** (B04). Vitest 2.1 + Playwright 1.49 wired;
  42/42 unit suites green on the new LMS surface; demo-loop e2e spec written.
  Commit `d2f9a19`.
- **S1.6 — Security hardening** (B01 + B02). B01 — argon2id via `hash-wasm`
  with lazy re-hash for legacy admin rows + HMAC-SHA-256 for opaque tokens.
  Documented in [ADR-0008](../../docs/decisions/0008-password-hashing-argon2id-plus-lazy-rehash.md).
  B02 — `requireAuth` / `requireRole` guards on every `convex/lms/*`
  function + `userId` plumbed through from frontend callers. Commits
  `4b1c441`, `0ab05be`.
- **S1.7 — Lint hard gate** (B03). 8 errors + 16 warnings cleared; CI `lint`
  job flipped from reporter to hard gate. Commit `748847e`.
- **S1.8 — Docs** (F01, this task). ADRs 0005–0008 written + spec/quickstart
  updated + orphan `RESEND_API_KEY` removed from `.env.local.example`.

### Spec drifts resolved

Two Sprint-0 carry-forward drifts on the ingestion path were closed in E03:

1. Malformed `imsmanifest.xml` previously created an `lmsCourses` row with
   empty `scoFiles`. The action now rejects with a structured validation
   error and writes nothing.
2. Duplicate ingests for the same package now archive the prior course
   (`status = "archived"`) rather than colliding.

### Cross-cutting discovery (C04)

The repo-root `middleware.ts` was never loaded by Next 15 with the `src/app/`
directory layout — the institutional admin protection that everyone assumed
was running at the edge had silently been a no-op at the middleware layer
(route handlers still enforced auth server-side, so no actual exposure
occurred, but the edge gate was inert). C04 moved the file to
`src/middleware.ts`, at which point the admin protection genuinely runs at
the edge for the first time. The learner branch lives next to the admin
branch in the same file, per [ADR-0007](../../docs/decisions/0007-learner-auth-magic-link-plus-password.md).

### ADRs added or finalized in Sprint 1

- [ADR-0005](../../docs/decisions/0005-same-origin-proxy-for-sco-assets.md) — locks the Sprint-0 implementation note into an architectural decision.
- [ADR-0006](../../docs/decisions/0006-ingest-scorm-package-as-convex-action.md) — locks the action + internalMutation split.
- [ADR-0007](../../docs/decisions/0007-learner-auth-magic-link-plus-password.md) — locks the learner-auth model.
- [ADR-0008](../../docs/decisions/0008-password-hashing-argon2id-plus-lazy-rehash.md) — promoted from B01 stub to fully-prosed Accepted ADR.

## Sprint 2 — Ventas (B2C Checkout)

A learner browsing `/cursos` sees a price and a "Comprar" CTA. Clicking opens
MercadoPago Checkout Pro; on payment the learner returns enrolled, receives a
confirmation email, and the 80/20 revenue split is recorded.

### Capabilities

- **S2.1 — Pricing on catalog.** `priceUsd` on courses + admin edit; price
  shown on the catalog and course pages.
- **S2.2 — Sales domain.** `lmsOrders` + `lmsPayments` + `lmsRevenueShares`
  tables behind a `PaymentProvider` interface ([ADR-0009](../../docs/decisions/0009-paymentprovider-interface-checkout-pro.md)).
- **S2.3 — Checkout flow.** `createCheckout` action opens the MP preference;
  return pages (`exito` / `error` / `pendiente`) read DB truth, not the
  `back_url` ([ADR-0012](../../docs/decisions/0012-order-payment-state-machine.md)).
- **S2.4 — Webhook handler.** Verify-before-trust, idempotent ([ADR-0010](../../docs/decisions/0010-webhook-idempotency-verify-before-trust.md)).
- **S2.5 — Entitlement.** Lookup-before-insert enrollment, internal-only.
- **S2.6 — Revenue ledger.** 80/20 split per SDD §3.3, USD-anchored ([ADR-0011](../../docs/decisions/0011-usd-pricing-mp-side-ars-conversion.md)).
- **S2.7 — Buyer email.** Idempotent on webhook duplication (scheduled action).
- **S2.8 — Observability.** Structured JSON money-path logs + secret hygiene.
- **S2.9 — Tests.** Unit + integration + e2e; T1/T2/T3 are release gates.
- **S2.10 — Docs.** ADRs 0009–0012 + spec/quickstart + payout runbook
  (`ops/payout-runbook.md`).

### Test the full flow (dev, against the MP sandbox)

1. **Set the Convex env (TEST credentials only):**
   ```bash
   npx convex env set MP_ACCESS_TOKEN TEST-<your-test-token>
   npx convex env set MP_WEBHOOK_SECRET <your-test-webhook-secret>
   npx convex env set MP_PUBLIC_KEY TEST-<your-test-public-key>
   npx convex env set ZEPHYRA_PUBLIC_URL http://localhost:3000
   ```

2. **Start the dev server:** `npm run dev`

3. **Manual e2e:**
   - Navigate to `http://localhost:3000/cursos`, sign in as a learner.
   - Open a purchasable course; see the price and "Comprar".
   - Click → redirected to MP Checkout Pro (sandbox) → complete the mock payment.
   - Auto-return to `/cursos/<slug>/compra/exito`.
   - Verify the `lmsEnrollments` row in the Convex console; "Ir al curso" opens
     the player.

4. **Webhook reachability (dev):** the Convex dev deployment exposes a public
   `.convex.site` HTTP endpoint, so the MP sandbox can reach
   `https://<deployment>.convex.site/api/lms/mp/webhook` directly — no tunnel.

5. **View logs:** Convex console → Logs → filter by `orderId` or `mpPaymentId`.
   Every money-path event is one structured JSON line (`domain: "lms.payment"`).

### Secrets & observability

MP credentials are read **only** from the Convex env inside Convex functions —
never hardcoded, never in `.env` files, never logged. The money-path logger
(`convex/lms/payment/logging.ts`) emits the buyer's `learnerId` (opaque id) and
never the email address or any card data.

---

## Sprint 3 — Sales Pack + Org Admin (B2B seats + privacy)

**Branch:** `feature/010-zephyra-lms-packs` · **Convex dev:** `dev:exuberant-corgi-88`
**ADRs:** 0013 (data model), 0014 (pricing), 0015 (seat state machine), 0016 (privacy).

The B2B revenue spine: an organization buys a *pack* of seats for one course at a
volume-discounted price, a single Owner Admin assigns those seats to employees by
email, the invited employee claims a seat (becoming an `org_learner` with the same
player UX as B2C), and the admin sees the team's progress — aggregate by default,
nominal only for learners who consent.

### Capabilities (S3.1 – S3.10)

- **S3.1 — Org sign-up.** Magic-link-verified org creation; a single
  `ownerCustomerId` (no role matrix in V1). Routes `/empresa/registro[/crear]`.
- **S3.2 — B2B catalog.** Owner-gated catalog over the same `lmsCourses`, B2B
  framing. Route `/empresa/cursos`.
- **S3.3 — Volume-discount calculator + pack checkout.** Live quote
  (`computePackPrice`), server-authoritative pricing (ADR-0014); `50+` is
  contact-only. Pack checkout → MercadoPago Checkout Pro; the approved webhook
  mints `lmsSeatPacks` + N `lmsSeats` (idempotent on `orderId`, ADR-0015).
  Route `/empresa/cursos/[slug]` + `/empresa/compra/{exito,pendiente,error}`.
- **S3.4 — Seat invite.** "Asignar cupo" → `requestSeatInvite` mints an opaque
  invite token; the server action composes the claim URL and emails `SeatInvite`.
  Idempotent re-invite (live link) → "ya invitado". Single email (CSV is V1.5).
- **S3.5 — Seat claim → enrollment.** Claim landing `/empresa/invitacion` →
  `claimSeat` burns the token, creates/resolves the `org_learner`, claims one
  seat, creates ONE active enrollment, and routes into the B2C player. Replay
  (same `claimRequestId`) is idempotent; over-claim is rejected.
- **S3.6 — Seat release (marcar baja).** `releaseSeat` returns an UNSTARTED seat
  to the pool and ends the enrollment; a started learner cannot be released
  (zero-engagement gate, ADR-0015).
- **S3.7 — Org-Admin dashboard.** `/empresa` replaces the 3a shell: contracted
  courses (`getOrgSeatPacks` — total/asignados/disponibles + Asignar cupo /
  Comprar más cupos / Ver progreso), members (`getOrgRoster` — display email
  only), aggregate progress (`getOrgCourseProgress`). Course titles joined
  client-side via `listPublished`.
- **S3.8 — Consent (privacy-aware display).** Learner opt-in/out
  (`grantProgressConsent` / `revokeProgressConsent`, default OPT-OUT) at
  `/cursos/privacidad`. Admin nominal view (`getNominalProgress`) is gated
  server-side; denial → "sin consentimiento — solo agregado" (ADR-0016).
- **S3.9 — Money-path release gates.** Pack mint idempotency (one pack + N seats
  per paid order) + anti-tamper (server total, not client price). See
  `tests/unit/convex/lms/packMoneyPath.test.ts`.
- **S3.10 — Docs.** ADRs 0014–0016 + this spec section + quickstart org/pack flow.

### Test the full flow

- **Unit (Vitest):** pricing tiers, money-path gates, seat mutations, consent,
  and the frontend server actions (invite URL compose, claim session mint,
  nominal consent-denial mapping, release). 265 tests green.
- **E2E (Playwright):** `tests/e2e/org-packs.spec.ts` (sign-up → calculator →
  checkout redirect boundary) and `tests/e2e/org-seats.spec.ts` (invite → claim →
  player opens → dashboard reflects one consumed seat → nominal-without-consent
  state). The seats e2e SIMULATES only the MP purchase (drives the internal
  `createPackOrder` → `mintSeatPackForOrder` the approved webhook would call, via
  `npx convex run`); everything else runs for real against the dev deploy.

### Spec drifts resolved

- **Vitalicia supersedes PDD §10 (expiring licenses).** V1 ships lifetime
  licenses; the no-expiration model is recorded in ADR-0015 as superseding
  PDD §10. Re-introducing expiry is additive.
- **Single Owner Admin (no role matrix).** Locked in ADR-0013.
- **Dev learner-session secret parity.** `middleware.ts` used a different dev
  fallback secret than `auth-learner/lib/session.ts`, silently bouncing a
  freshly-minted learner (e.g. a just-claimed `org_learner`) to sign-in in any
  env without `LEARNER_JWT_SECRET`. Aligned to
  `fallback-learner-secret-for-development-only`. Production sets the secret, so
  this was a local-dev-only divergence.
