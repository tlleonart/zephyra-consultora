# Tasks: Zephyra LMS — Foundation (Sprint 0)

**Branch**: `feature/008-zephyra-lms-foundation` | **Date**: 2026-06-03
**Source**: SDD v3 §3.1–3.7, Sprint plan v3.

Esta es la fundación (Fase A). Las fases C / D / F / G se documentan en `plan.md` y se ejecutan en spawns posteriores.

## Fase A — Foundation (2 EU)

### T-ZL0-A01 — Branch + specs/008 scaffolding (1 EU)

- [x] AC-A01.1 Branch `feature/008-zephyra-lms-foundation` cortado de `main`.
- [x] AC-A01.2 `specs/008-zephyra-lms-foundation/` con la convención de 6 archivos (igual que specs 001–007): `spec.md`, `plan.md`, `data-model.md`, `research.md`, `tasks.md`, `quickstart.md`.
- [x] AC-A01.3 `plan.md` referencia SDD v3 como fuente de verdad; `research.md` enlaza PDD v1.3 + scorm-again + path del curso de muestra + doc de auditoría.
- [x] AC-A01.4 `quickstart.md` documenta (a) stub de reproducción del demo loop (se completa en Fase D) y (b) nota de estrategia de cookies JWT (admin reusa `session`; learner futuro usa `session-learner` + clave distinta — solo doc).
- [x] AC-A01.5 `data-model.md` lista las tablas Sprint-0 `lms*` (`lmsCourses`, `lmsScormEvents`, `lmsEnrollments`) con sus índices (PDD §6.3).
- [x] AC-A01.6 Fixture SCORM stageado en `specs/008-zephyra-lms-foundation/fixtures/` vía **Git LFS**.

### T-ZL0-A02 — Deps + schema subset + route groups + middleware + admin nav (1 EU)

- [x] AC-A02.1 `scorm-again` v3.x + lib de unzip en browser (JSZip) agregados a `package.json`.
- [x] AC-A02.2 `convex/schema.ts` extendido con el subset Sprint-0 (`lmsCourses`, `lmsScormEvents`, `lmsEnrollments`) con los índices del PDD §6.3. Tablas institucionales intactas. Prefijo `lms*`. Soft-delete donde aplica.
- [x] AC-A02.3 Funciones Convex LMS bajo `convex/lms/` (`courses.ts`, `scormEvents.ts`) — stubs, aisladas de las funciones institucionales.
- [x] AC-A02.4 Route groups: `src/app/(public)/cursos/...` y `src/app/(dashboard)/admin/lms/...` (matching la estructura real del repo).
- [x] AC-A02.5 `middleware.ts` protege `/admin/lms/*` con el auth admin existente — **heredado** del matcher `/admin` existente (documentado).
- [x] AC-A02.6 Nav admin actualizado para exponer la sección LMS junto a los 10 sub-routes existentes.
- [x] AC-A02.7 `npm install && npm run dev` levanta el sitio institucional MÁS `/admin/lms` y `/cursos` sin romper funcionalidad existente.
- [x] AC-A02.8 `npx convex dev` deploya el schema nuevo limpio contra **dev** (`exuberant-corgi-88`); las tablas `lms*` aparecen junto a las 11 existentes; institucionales intactas.

## Fases siguientes (no en este spawn)

- **Fase C** (2 EU, paralelo): `.github/workflows/ci.yml`.
- **Fase D** (6 EU, centerpiece): spike SCORM completo — ingest (D01) + player/bridge (D02) + `recordScormEvent` + proyección (D03) + `scorm-coverage.md`.
- **Fase F** (1 EU): ADRs.
- **Fase G** (3 EU): buffer.

Critical path: A01 → A02 → D01 → D02 → D03 → F01.
