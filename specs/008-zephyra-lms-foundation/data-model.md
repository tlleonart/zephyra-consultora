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

---

## Sprint 1 — Identidad de learner + Magic-link tokens

Sprint 1 añade dos tablas aditivas al schema. Las tres tablas Sprint 0 (`lmsCourses`, `lmsEnrollments`, `lmsScormEvents`) y las 11 institucionales quedan byte-idénticas.

### `lmsCustomers`

Agregado **Customer / Learner**. Tres subtipos: comprador individual (B2C), administrador de organización (B2B-admin), learner gestionado por organización (B2B-learner).

| Campo | Tipo | Notas |
|-------|------|-------|
| `email` | `string` | Lowercased. Único de facto vía índice + pre-check (la unicidad estricta llega cuando exista la action de creación en Phase B). |
| `type` | `"individual" \| "org_admin" \| "org_learner"` | Subtipo del aggregate. |
| `passwordHash` | `string?` | argon2id encoded string. Ausente hasta que el learner opte a setearlo (magic-link es el path primario). |
| `organizationId` | `string?` | Placeholder hasta Sprint 3; cuando aterrice `lmsOrganizations` se promueve a `Id<"lmsOrganizations">`. |
| `activatedAt` | `number?` | Timestamp del primer consume exitoso de magic-link de activación. |
| `lastLoginAt` | `number?` | Última sesión exitosa. |
| `createdAt` | `number` | |
| `deletedAt` | `number?` | Soft-delete. |
| `deletedBy` | `Id<"adminUsers">?` | **Solo administradores** pueden borrar (mitigación PDD H-2). |

**Índices:**
- `by_email` — `["email"]`
- `by_type` — `["type"]`
- `by_organization` — `["organizationId"]`
- `by_deleted` — `["deletedAt"]`

**Decisión: `passwordHash` opcional**
Magic-link es el path primario de auth para learners. Forzar password al activar suma fricción sin valor de seguridad: el flow de consume del magic-link ya valida posesión del email, y el token tiene TTL corto + single-use. El learner puede setear password después si quiere (`POST /api/auth/learner/set-password` en Phase C); también puede no hacerlo nunca y seguir entrando por magic-link. El campo permanece optional para reflejar ese estado real, no un `string` con valor centinela.

**Decisión: learners nunca como `deletedBy`**
PDD §H-2 (Habeas Data): el self-service de eliminación de cuenta del learner se procesa por un admin, no por el propio learner. Razones: (a) traza forense — siempre hay un actor con rol admin auditable; (b) ventana de reversión — el admin puede confirmar antes de soft-delete; (c) modelo de poderes — el dueño del dato (Zephyra) es el responsable legal del borrado. Constraint: `deletedBy` es `Id<"adminUsers">` (no `Id<"lmsCustomers">`), reforzado a nivel tipo.

---

### `lmsMagicLinkTokens`

Tabla de **tokens opacos de magic-link**. Un row por token emitido. Single-use: `usedAt` se estampa en el consume y el row queda como histórico (no se borra; expira fuera-de-banda por TTL del schedule de cleanup, no por este sprint).

| Campo | Tipo | Notas |
|-------|------|-------|
| `email` | `string` | Lowercased. Puede no existir todavía como `lmsCustomers` (el flow de activación crea el customer al consumir). |
| `tokenHash` | `string` | HMAC-SHA-256(rawToken, MAGIC_LINK_HMAC_KEY). Ver decisión abajo. |
| `purpose` | `"learner_activation" \| "learner_signin" \| "learner_recovery"` | Discrimina TTL y handler de consume. |
| `expiresAt` | `number` | Timestamp ms absoluto. TTL: 30 min activación, 15 min signin/recovery (enforced en mutation de consume, no en schema). |
| `usedAt` | `number?` | Single-use enforcement: si ya tiene valor, consume rechaza. |
| `createdAt` | `number` | |
| `createdFromIp` | `string?` | Forensic, opcional. Útil para detectar abuso (rate-limit por IP en Phase B). |

**Índices:**
- `by_token` — `["tokenHash"]` (lookup O(1) en consume)
- `by_email_purpose` — `["email", "purpose"]` (rate-limit y "ya tenés un link en tu bandeja, mirá ahí" UX)
- `by_expires` — `["expiresAt"]` (cleanup job barre por este índice)

**Decisión: `tokenHash` con HMAC-SHA-256, no argon2id**
`argon2id` está diseñado para hashear secretos de baja entropía elegidos por humanos (passwords). Cuesta CPU intencionalmente para frenar fuerza bruta. Los magic-link tokens NO son secretos de baja entropía: son strings opacos de 32 bytes random (256 bits de entropía real). Fuerza bruta es matemáticamente irrelevante. Aplicar argon2id a un token random es quemar 100ms+ de CPU por verify para ganar 0 bits efectivos de seguridad — confunde el modelo de amenazas.

HMAC-SHA-256 con una clave server-side (`MAGIC_LINK_HMAC_KEY`, 32 bytes random) da exactamente lo que necesitamos: si la DB se filtra, el atacante no puede recuperar los raw tokens sin la clave, y verify es O(1). Es el patrón estándar para tokens opacos (OAuth refresh tokens, session IDs, API keys con prefix).

**Decisión: `email` no es FK**
El flow de activación crea el `lmsCustomers` al consumir el token. Forzar `Id<"lmsCustomers">` rompería el caso: o emitís el token sin saber el customer (imposible), o creás el customer antes (deja huérfanos si nunca consume). Quedarse en `string` + lookup por email lateral es el patrón correcto.

---

## Invariantes Sprint 1

- `lmsCustomers.email` único en la práctica vía pre-check en mutation de creación (no hay constraint nativo en Convex; se enforce en código).
- `lmsCustomers.deletedBy` siempre es `Id<"adminUsers">` (typesafe).
- `lmsMagicLinkTokens.usedAt = null` antes del consume; estamparlo es atómico dentro de la mutation de consume (lectura + write en la misma transacción).
- `lmsMagicLinkTokens.tokenHash` es HMAC-SHA-256 del raw token; el raw token jamás se persiste.
- Activación = primer consume exitoso de `purpose: "learner_activation"` → patchea `lmsCustomers.activatedAt = now()` (o lo crea si no existe el customer).
