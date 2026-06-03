# Data Model: Zephyra LMS — Foundation (Sprint 0)

**Date**: 2026-06-03
**Branch**: `feature/008-zephyra-lms-foundation`
**Source**: PDD v1.3 §6.3 (subset Sprint 0 per SDD v3 §3.2)

## Convención de namespace

Todas las tablas del LMS llevan prefijo `lms*` para aislarlas de las 11 tablas institucionales existentes (`adminUsers`, `passwordResetTokens`, `blogPosts`, `teamMembers`, `projects`, `projectAchievements`, `serviceBlocks`, `services`, `clients`, `alliances`, `newsletterSubscribers`). El cambio de schema es **aditivo**; las tablas institucionales no se tocan.

Patrón de soft-delete heredado del repo: `deletedAt?: number, deletedBy?: Id<"adminUsers">` (donde aplica).

## Subset Sprint 0

El set completo de agregados del PDD §6.3 (`lmsPackSkus`, `lmsCustomers`, `lmsOrganizations`, `lmsOrders`, `lmsPayments`, `lmsSeatPacks`, `lmsSeats`, `lmsProgressConsents`, `lmsRevenueShares`, `lmsPayouts`) llega en Sprint 1. Sprint 0 aterriza solo lo suficiente para el spike: **`lmsCourses`, `lmsScormEvents`, `lmsEnrollments`**.

---

### `lmsCourses`

Agregado **Course**. Una fila por curso SCORM ingestado. CAMPUS no reversiona: una actualización de curso = nuevo `campusCourseId` = nueva fila (la vieja pasa a `status: "archived"`, nunca se borra).

| Campo | Tipo | Notas |
|-------|------|-------|
| `campusCourseId` | `string` | Único. Identificador del proveedor. |
| `title` | `string` | |
| `slug` | `string` | Para la ruta `/cursos/<slug>`. |
| `status` | `"draft" \| "published" \| "archived"` | |
| `scormStorageId` | `Id<"_storage">?` | Zip original (opcional; el spike sube por archivo). |
| `scoFiles` | `object?` | Mapa relative-path → `Id<"_storage">` de los archivos del SCO. |
| `manifest` | `string?` | `imsmanifest.xml` parseado (serializado). |
| `scoStructure` | `any?` | Organizations + items + resources extraídos del manifest. |
| `entryPoint` | `string?` | Path del recurso de entrada (launch). |
| `createdAt` | `number` | |
| `updatedAt` | `number` | |
| `deletedAt` | `number?` | Soft-delete. |
| `deletedBy` | `Id<"adminUsers">?` | Soft-delete. |

**Índices:**
- `by_campus_course_id` — `["campusCourseId"]` (unicidad del proveedor)
- `by_slug` — `["slug"]`
- `by_status` — `["status"]`
- `by_deleted` — `["deletedAt"]`

---

### `lmsEnrollments`

Agregado **Enrollment**. En Sprint 0 se crea un row placeholder manual para el spike (el flujo real de claim/seat llega en Sprint 1).

| Campo | Tipo | Notas |
|-------|------|-------|
| `seatId` | `string?` | (Sprint 1) único cuando exista el seat real. |
| `learnerId` | `string` | Placeholder en Sprint 0 (no hay `lmsCustomers` todavía). |
| `courseId` | `Id<"lmsCourses">` | |
| `status` | `"active" \| "completed" \| "expired"` | |
| `claimRequestId` | `string?` | (Sprint 1) idempotencia de claim — único cuando exista. |
| `startedAt` | `number?` | |
| `firstTouchedAt` | `number?` | Señal de engagement (invariante de release de seat, Sprint 1). |
| `expiresAt` | `number?` | |
| `progressPercent` | `number` | Proyección desde eventos SCORM. |
| `scoreRaw` | `number?` | Proyección desde eventos SCORM. |
| `lessonStatus` | `string?` | Proyección de `cmi.core.lesson_status`. |
| `suspendData` | `string?` | Proyección de `cmi.suspend_data`. |
| `updatedAt` | `number` | |

**Índices:**
- `by_course` — `["courseId"]`
- `by_learner` — `["learnerId"]`
- `by_learner_course_status` — `["learnerId", "courseId", "status"]` (invariante: no dos enrollments `active` del mismo learner+curso — PDD §6.3)
- `by_claim_request` — `["claimRequestId"]` (idempotencia de claim, Sprint 1)

---

### `lmsScormEvents`

**SCORM event log** — trail de auditoría append-only. Una fila por llamada SCORM relevante (`LMSSetValue` / `LMSCommit`). Nunca se actualiza ni se borra.

| Campo | Tipo | Notas |
|-------|------|-------|
| `enrollmentId` | `Id<"lmsEnrollments">` | |
| `timestamp` | `number` | |
| `element` | `string` | p.ej. `cmi.core.lesson_status`, `cmi.core.score.raw`. |
| `value` | `string` | Valor crudo enviado por el contenido. |
| `commitId` | `string?` | Agrupa los SetValue de un mismo Commit. |

**Índices:**
- `by_enrollment` — `["enrollmentId"]`
- `by_enrollment_timestamp` — `["enrollmentId", "timestamp"]` (lectura ordenada del trail)
- `by_commit` — `["commitId"]`

---

## Invariantes relevantes (Sprint 0)

- `lmsCourses.campusCourseId` único (vía índice + pre-check en mutation de ingest).
- `lmsScormEvents` es append-only: solo inserts, jamás patch/delete.
- `lmsEnrollments` se proyecta desde `lmsScormEvents` (Fase D): cada evento se appendea Y el agregado se patchea (`progressPercent`, `scoreRaw`, `lessonStatus`, `suspendData`).

El resto de los invariantes del §6.3 (balance de seats, idempotencia de payment, etc.) son Sprint 1.
