# Quickstart: Zephyra LMS — Foundation (Sprint 0)

**Date**: 2026-06-03
**Branch**: `feature/008-zephyra-lms-foundation`

## Prerequisites

- Node.js 20.9+
- npm
- Git + **Git LFS** (`git lfs install`) — el fixture SCORM se versiona vía LFS.
- Acceso al deploy de Convex **dev** `exuberant-corgi-88` (proyecto `zephyra-dev`).

## 1. Setup

```bash
git clone <repo-url>
cd zephyra-consultora
git checkout feature/008-zephyra-lms-foundation

# Traer el fixture SCORM versionado en LFS
git lfs pull

# Instalar dependencias (incluye scorm-again + jszip nuevos en este sprint)
npm install
```

`.env.local` debe apuntar al deploy **dev**:

```
CONVEX_DEPLOYMENT=dev:exuberant-corgi-88   # NUNCA prod en Sprint 0
NEXT_PUBLIC_CONVEX_URL=https://exuberant-corgi-88.convex.cloud
```

## 2. Levantar el entorno

```bash
# Terminal 1 — Convex dev (deploya el schema lms* contra dev)
npx convex dev

# Terminal 2 — Next.js
npm run dev
```

Rutas esperadas tras Fase A:
- Sitio institucional intacto: `/`, `/blog`, `/proyectos`, `/contacto`, `/admin`.
- Nuevas: `/cursos` (público), `/admin/lms` (admin, protegido).

## 3. Demo loop del spike SCORM (Fase D — reproducible en <15 min)

Implementado en Fase D. Reproduce AC-6 (intro en iframe), AC-7 (bridge
`scorm-again`) y AC-8 (eventos persisten + proyección) desde un clone limpio.

### 3.1 Ingesta del curso (vía admin UI)

1. Iniciar sesión en `/login` con una cuenta admin (`adminUsers`).
2. Ir a **`/admin/lms`** → botón **"+ Ingestar SCORM"** (o directo a
   `/admin/lms/courses/new`).
3. Seleccionar el `.zip` de muestra:
   `specs/008-zephyra-lms-foundation/fixtures/scorm12_diversidad_equidad_e_inclusion.zip`.
4. El navegador lo descomprime con JSZip, **filtra los 17 archivos `.bak.*`**
   (quedan 50 archivos), sube cada uno en paralelo (8 a la vez) a Convex
   `_storage`, y llama a la action `ingestScormPackage`, que lee
   `imsmanifest.xml` desde `_storage`, lo parsea y crea la fila `lmsCourses`
   (`status: "draft"`). El log en pantalla muestra los tiempos.
   - Tiempo observado: ~50 archivos en **~10 s**; parse de manifest **1 ms**.
5. Al terminar, botón **"Abrir player →"** lleva a `/cursos/<slug>/player`.

> El slug del curso de muestra es
> `diversidad-equidad-e-inclusion-en-el-trabajo-como-construir-entornos-laborales-r`.

### 3.2 Player + bridge + persistencia

6. En el player, la barra superior muestra **Progreso / Estado / Puntaje** en
   vivo (query reactiva a `lmsEnrollments`). La intro del curso renderiza dentro
   del `<iframe sandbox="allow-scripts allow-same-origin">` (**AC-6**), servida
   desde `_storage` vía el proxy same-origin `/api/lms/asset/<slug>/<path>`.
7. En la nav izquierda, clic en **"Fundamentos de diversidad e inclusión"**
   (unidad_01). Abrir DevTools → Console: el wrapper del proveedor loguea
   **`[SCORM 1.2] SCORM 1.2 API encontrada en intento 2`** seguido de
   `SCORM 1.2 API inicializada correctamente` (**AC-7**). Esto confirma que el
   contenido encontró nuestro `window.API` (expuesto por `scorm-again` en la
   página padre, instalado **antes** de cargar el iframe).
8. Dentro de la unidad, abrir la sección **"Evaluación: Fundamentos de
   diversidad"**, responder algunas preguntas y **"Enviar respuestas"**. La
   consola muestra `LMSSetValue("cmi.core.score.raw", ...)` y
   `LMSSetValue("cmi.core.lesson_status", "failed"|"passed")`.
9. **Verificación (AC-8)** — en el Convex dashboard (dev `exuberant-corgi-88`),
   tabla `lmsScormEvents`: filas nuevas acumulándose (lesson_status, score.raw,
   score.min/max, suspend_data, session_time, marcadores `__commit__`). Tabla
   `lmsEnrollments`: la fila del curso muestra `lessonStatus`, `scoreRaw`,
   `progressPercent` y `suspendData` actualizados en vivo (la barra superior del
   player refleja el cambio sin recargar).

### 3.3 Por qué el proxy same-origin (decisión clave, S0-R3)

El contenido CAMPUS descubre la API recorriendo `window.parent` y además llama
`window.parent.document.querySelectorAll('iframe')`. Si el iframe se sirviera
desde `*.convex.cloud` (otro origen que la página del player), la política de
mismo-origen del navegador **bloquearía** tanto `window.parent.API` como
`window.parent.document` y el bridge **nunca** funcionaría. Por eso todos los
assets del SCO se sirven desde el origen de la app Next.js, vía el route handler
`/api/lms/asset/[slug]/[...path]`, que streamea desde Convex `_storage`. No se
usó `getUrl` directo para los assets del SCO; sí internamente dentro del proxy.

### 3.4 Enrollment placeholder

El spike usa una fila `lmsEnrollments` placeholder (`learnerId: "spike-learner"`,
`status: "active"`) creada idempotentemente por `ensureSpikeEnrollment` al montar
el player. El flujo real de seat/claim es Sprint 1.

Objetivo de reproducibilidad (SDD v3): un teammate reproduce el demo desde un
clone limpio en <15 min. ✅

## 4. Estrategia de cookies JWT (nota de diseño — solo documentación en Sprint 0)

El LMS introduce dos audiencias de autenticación con **dos cookies y dos claves de firma distintas**:

| Audiencia | Cookie | Clave de firma | Estado |
|-----------|--------|----------------|--------|
| Admin (Zephyra-Admin / Operador interno) | `session` (existente) | `SESSION_SECRET` (existente) | **En producción hoy.** Reusado tal cual. Protege `/admin` y `/admin/lms`. |
| Learner (alumno del curso) | `session-learner` (futuro) | clave de firma **distinta** (p.ej. `SESSION_LEARNER_SECRET`) | **Sprint 1.** Solo documentado aquí; sin wiring en Sprint 0. |

Razones del aislamiento:
- Un compromiso de la cookie de learner no debe escalar a privilegios de admin (y viceversa).
- Claves de firma separadas → un token de learner jamás valida como sesión admin aunque alguien lo reuse.
- El middleware actual valida solo la cookie `session` para `/admin`. Cuando llegue el wiring de learner (Sprint 1), se agregará validación de `session-learner` para las rutas de learner bajo `/cursos/*` que lo requieran, sin tocar la lógica de admin.

**En Sprint 0 esto es documentación de diseño. No se implementa wiring de learner.**

## 5. Disciplina de regresión

Antes de cerrar cualquier fase, verificar que el sitio institucional sigue funcionando: `/`, `/blog`, `/proyectos`, `/contacto`, `/admin`. El cambio de schema es aditivo; si algo regresiona, revertir y aislar.

## 6. Dev superadmin bootstrap (Sprint 1, post B01)

The `convex/adminUsers.ts:seedSuperAdmin` internal mutation no longer carries a
literal default password. To bootstrap a dev superadmin row:

1. Set `DEV_ADMIN_DEFAULT_PASSWORD` in `.env.local` to any value (32-byte hex
   recommended — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
2. Push the same value to the Convex dev deployment:
   ```bash
   npx convex env set DEV_ADMIN_DEFAULT_PASSWORD <value>
   ```
3. Invoke the seed from the Convex dashboard or CLI:
   ```bash
   npx convex run adminUsers:seedSuperAdmin
   ```
   (If the env var is missing, the mutation throws a clear error — no silent
   fallback to a known literal.)

`MAGIC_LINK_HMAC_KEY` follows the same flow — required by `requestPasswordReset`
and the learner magic-link mutations landing in B02/C02.

---

# Sprint 1 — Quickstart additions

The sections below cover the Sprint 1 surface (learner auth, full player,
catalog, hardening) and the dev environment required to run them locally.

## 7. Dev environment setup (Sprint 1)

`.env.local` for a Sprint 1 dev session needs the following keys. Generators
below assume Node.js 20+.

| Variable | Purpose | How to generate |
|---|---|---|
| `CONVEX_DEPLOYMENT` | Convex dev project ref. | Filled by `npx convex dev` on first run. Sprint 1 uses `dev:exuberant-corgi-88`. |
| `NEXT_PUBLIC_CONVEX_URL` | Convex HTTP URL for the same dev project. | Set alongside `CONVEX_DEPLOYMENT` by `npx convex dev`. |
| `SESSION_SECRET` | Admin JWT signing key (HS256). 32+ bytes. | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `LEARNER_JWT_SECRET` | Learner JWT signing key (HS256). **Must be distinct from `SESSION_SECRET`.** | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `MAGIC_LINK_HMAC_KEY` | HMAC-SHA-256 key for opaque tokens (`passwordResetTokens`, `lmsMagicLinkTokens`). | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `DEV_ADMIN_DEFAULT_PASSWORD` | Bootstrap password for `seedSuperAdmin`. No literal lives in the repo. | Any reasonable value — `node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"` works. |
| `EMAIL_USER` / `EMAIL_PASSWORD` | Ferozo SMTP credentials. Optional in dev — if unset, the mailer prints to console (see §11). | Provided by ops for real sending. |
| `NEXT_PUBLIC_APP_URL` | Base URL injected into outgoing email links. | `http://localhost:3000` in dev. |

> Convex env vars (`MAGIC_LINK_HMAC_KEY`, `DEV_ADMIN_DEFAULT_PASSWORD`, etc.)
> must also be pushed to the Convex deployment:
> ```bash
> npx convex env set MAGIC_LINK_HMAC_KEY <value>
> npx convex env set DEV_ADMIN_DEFAULT_PASSWORD <value>
> ```
> Functions throw at call time if a required key is missing — there is no
> silent fallback.

## 8. Seed a dev admin

After §7 is complete:

```bash
# From the Convex CLI:
npx convex run adminUsers:seedSuperAdmin
```

Or invoke `adminUsers:seedSuperAdmin` from the Convex dashboard
(`Functions → adminUsers → seedSuperAdmin → Run`). The seeded row uses the
value of `DEV_ADMIN_DEFAULT_PASSWORD` from the deployment's env. The new row
is created with an argon2id hash from the first write
(see [ADR-0008](../../docs/decisions/0008-password-hashing-argon2id-plus-lazy-rehash.md)).

## 9. Learner sign-up flow walkthrough

Reproducible from a clean dev environment.

1. Open `/cursos` — catalog renders against `lmsCourses.status = "published"`.
2. Click any course → `/cursos/<slug>` shows the detail page + CTA.
3. Click the CTA → `/cursos/auth/signup`. Enter an email.
4. The server action mints an `lmsMagicLinkTokens` row with
   `purpose: "learner_activation"`, TTL 30 min, single-use, `tokenHash` via
   HMAC-SHA-256.
5. Watch the Next.js dev server console: if `EMAIL_USER` is unset, the
   mailer logs the full magic-link URL (`[mailer-dev] magicLinkUrl=...`).
   If `EMAIL_USER` is set, the link is sent through Ferozo SMTP.
6. Open the magic link → `/cursos/auth/verify?token=...` — the token is
   consumed (`usedAt` set), an `lmsCustomers` row is created, and a
   `session-learner` cookie is set.
7. The learner lands on `/cursos` as an authenticated learner.

Optional: set a password from `/cursos/auth/set-password` so future logins
do not require the magic-link round-trip. Set passwords are hashed with the
same argon2id config as admin passwords.

## 10. Learner sign-in flow

`/cursos/auth/signin` supports both modes:

- **Magic-link mode (default).** Enter email → magic-link sent with
  `purpose: "learner_signin"`, TTL 15 min, single-use.
- **Password mode.** Visible only for learners who set a password in §9. The
  request runs through the same `convex/lms/auth.ts` mutation that verifies
  argon2id (with lazy upgrade for any legacy hash that survives in the
  future).

`/cursos/auth/recovery` covers forgotten-password / forgotten-everything
cases via `purpose: "learner_recovery"`, TTL 15 min, single-use.

## 11. Mailer dev behavior

The mailer is **Nodemailer 8 + React Email + Ferozo SMTP** (`src/lib/mailer/`
and `src/lib/mailer/learner.ts`). There is **no Resend dependency** — the
`RESEND_API_KEY` placeholder that lived in `.env.local.example` during
Sprint 0 was an orphan from a prior PDD draft and was removed in F01.

Behavior matrix:

| `EMAIL_USER` set? | Result |
|---|---|
| **No** | Mailer logs to the Next.js console (subject, recipient, magic-link URL, preview HTML). No SMTP call is made. Sprint 1 dev default. |
| **Yes** (with `EMAIL_PASSWORD`) | Mailer sends through `c2810738.ferozo.com:465` over TLS, signing-in with the supplied credentials. |

React Email templates remain provider-agnostic; the SMTP transport can be
swapped to a hosted provider later without touching template code (see
[ADR-0001 footnote, 2026-06-05](../../docs/decisions/0001-extend-zephyra-consultora-with-lms.md)).

## 12. Demo loop reproduction (Sprint 1 — full)

End-to-end happy path, reproducible from a clean clone after §7 + §8.

1. **Admin login.** `/login` with the seeded admin (email + the value of
   `DEV_ADMIN_DEFAULT_PASSWORD` in dev). Lazy re-hash upgrades any legacy
   row to argon2id silently on this login.
2. **Admin ingests a SCORM package.** `/admin/lms` → `+ Ingestar SCORM` →
   pick `specs/008-zephyra-lms-foundation/fixtures/scorm12_diversidad_equidad_e_inclusion.zip`.
   Wait for the ingestion log; publish the course.
3. **Admin issues an enrollment.** From `/admin/lms/learners` (or the
   course detail page), issue an enrollment for the learner email used in §9.
4. **Learner signs in.** `/cursos/auth/signin` → magic-link mode → consume.
5. **Player loads.** `/cursos/<slug>/player` renders the SCO inside the
   sandboxed iframe, served same-origin via
   `/api/lms/asset/<slug>/[...path]` (see [ADR-0005](../../docs/decisions/0005-same-origin-proxy-for-sco-assets.md)).
6. **SCO interaction.** Answer the evaluation; the wrapper logs
   `[SCORM 1.2] SCORM 1.2 API encontrada en intento N` and
   `LMSSetValue("cmi.core.lesson_status", ...)` calls flow.
7. **Events persist.** Convex dashboard → `lmsScormEvents` rows accumulate;
   `lmsEnrollments` row for the learner is projected (lessonStatus, scoreRaw,
   progressPercent, suspendData).
8. **Multi-SCO navigation.** For courses with more than one SCO, the left
   nav is enabled. Navigating between SCOs preserves per-SCO progress and
   rolls up into `progressPercent` on the aggregate row (D02).

Targets: clean clone → demo running in <15 min. ✅
