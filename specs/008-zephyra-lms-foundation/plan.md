# Implementation Plan: Zephyra LMS — Foundation (Sprint 0)

**Branch**: `feature/008-zephyra-lms-foundation` | **Date**: 2026-06-03 | **Spec**: [spec.md](./spec.md)
**Source of truth**: **SDD v3** (`sdd-SPRINT-ZEPHYRA-LMS-0`, secciones §3.1–3.7) y **PDD v1.3** (`pdd-zephyra-lms`, §6.3 tablas `lms*`, §7.5 auth, Risk-INFRA).

## Summary

Sprint 0 extiende el repo de producción `zephyra-consultora`. El SDD v3 es la fuente canónica de la arquitectura de este sprint; este `plan.md` deriva de él y NO lo contradice. Donde el SDD difiere de versiones previas (v1 greenfield Payload/Postgres/R2), el SDD v3 prevalece: el stack real es Next.js 15 + Convex + JWT `jose` + Nodemailer.

El plan se ejecuta en fases (sprint plan v3):

| Fase | Contenido | EU |
|------|-----------|----|
| **A** | Branch + specs/008 scaffolding + deps + schema `lms*` subset + route groups + middleware + admin nav | 2 |
| C | `.github/workflows/ci.yml` (paralelo) | 2 |
| **D** | **SCORM player spike** (centerpiece): unzip browser + upload por archivo + ingest mutation + iframe player + bridge scorm-again + `recordScormEvent` + proyección `lmsEnrollments` | 6 |
| F | ADRs | 1 |
| G | Buffer | 3 |

Esta planilla cubre **Fase A** (T-ZL0-A01 + T-ZL0-A02).

## Technical Context

**Language/Version**: TypeScript 5.7, Node.js 20.9+
**Framework**: Next.js 15.1 (App Router, Server Components)
**Primary Dependencies**: Convex 1.17.x (DB + file storage + functions), `jose` (JWT custom), Nodemailer. NUEVAS en este sprint: `scorm-again` (bridge SCORM 1.2/2004), JSZip (unzip en browser).
**Storage**: Convex `_storage` (para los archivos SCORM, per-file upload).
**Auth**: JWT custom con `jose` + tabla `adminUsers` + cookie `session` (reusado para los roles de administración: Zephyra-Admin y el Operador interno). Learner auth difiere a Sprint 1.
**Testing**: Vitest (unit), Playwright (e2e).
**Target Platform**: Web (Vercel + Convex Cloud). Convex deploy: **dev `exuberant-corgi-88`** — NUNCA prod en Sprint 0.
**Project Type**: Web application (fullstack, extensión de repo existente).
**Constraints**: Cambio de schema aditivo; tablas `lms*` prefijadas; sitio institucional no debe regresionar.

## Constitution Check

| Principio | Estado | Evidencia |
|-----------|--------|-----------|
| I. Calidad del Código | ✅ PASS | TypeScript strict, ESLint, namespace `lms*`, sigue patrón soft-delete existente |
| II. Estándares de Testing | ✅ PASS | Vitest + Playwright ya configurados; spike validable en Convex dashboard |
| III. Consistencia en UX | ✅ PASS | Nav admin reusa el componente `Sidebar` existente; route groups siguen patrón `(public)`/`(dashboard)` |
| IV. Documentación Exhaustiva | ✅ PASS | spec-kit 6 archivos; ADRs en Fase F; coverage matrix en Fase D |
| V. Performance Óptima | ✅ PASS | Server Components; Convex reactivo; schema aditivo no afecta queries existentes |

**Gates adicionales:**
- ✅ Cambio de schema aditivo verificado contra **dev** antes de cualquier push.
- ✅ Disciplina de regresión: rutas institucionales verificadas al cierre.
- ✅ Anonimato cloud: ningún nombre interno de agente en código, commits, comentarios o docs.

## Phase A — desglose

### T-ZL0-A01 — Branch + specs/008 scaffolding (1 EU)
Branch cortado de `main`; los 6 archivos de spec; fixture SCORM stageado.

### T-ZL0-A02 — Deps + schema subset + route groups + middleware + admin nav (1 EU)
Dependencias; `convex/schema.ts` extendido con `lmsCourses` / `lmsScormEvents` / `lmsEnrollments`; stubs `convex/lms/`; route groups `(public)/cursos` + `(dashboard)/admin/lms`; middleware confirmado; nav admin actualizado; deploy dev limpio.

## Riesgos (de SDD v3)

- **S0-R6**: agregar tablas `lms*` al schema Convex live podría interactuar con el deploy del sitio institucional. Mitigación: cambio aditivo, verificar `npx convex dev` limpio contra **dev** antes de push; revertir si hay regresión.
- **S0-R8**: parse de manifest grande podría aproximarse al timeout de mutation Convex. No aplica en Fase A (relevante en Fase D); mitigación documentada: refactor a `action` si el parse >5s.

## Notas de merge

PR-por-fase. Tomás testea manualmente cada PR de fase; el merge a `main` lo ejecuta el orquestador tras confirmación de Tomás. El ejecutor **nunca** mergea.
