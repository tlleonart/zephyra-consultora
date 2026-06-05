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
