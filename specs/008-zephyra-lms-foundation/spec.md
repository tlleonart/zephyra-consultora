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

- **FR-A01**: El repo debe tener una rama de feature aislada cortada de `main`. NO se mergea a `main` en este sprint (Tomás testea; el equipo de Carbono14 ejecuta el merge tras su confirmación).
- **FR-A02**: La documentación de especificación debe seguir la convención existente del repo (spec-kit, 6 archivos markdown).
- **FR-A03**: El schema de Convex debe extenderse de forma **aditiva** con el subset `lms*`; las 11 tablas institucionales quedan intactas.
- **FR-A04**: La superficie de rutas debe escalar a dos audiencias: pública (`/cursos`) y admin (`/admin/lms`).
- **FR-A05**: La sección admin del LMS debe estar protegida por la misma autenticación que el resto de `/admin`.
- **FR-A06**: El admin debe poder ver la sección LMS en la navegación lateral.

## Criterios de aceptación (binarios)

Ver `tasks.md` para el desglose por tarea (T-ZL0-A01, T-ZL0-A02) con sus ACs verificables.

## Disciplina de regresión (HARD)

Este es un codebase de producción. Cualquier cambio de schema/ruta/nav que rompa el sitio institucional (`/`, `/blog`, `/proyectos`, `/contacto`, `/admin`) debe revertirse y aislarse. El cambio de schema es **aditivo** y todas las tablas LMS llevan prefijo `lms*`.
