# SCORM 1.2 — Matriz de cobertura de elementos CMI

**Sprint:** SPRINT-ZEPHYRA-LMS-0 — Fase D (spike)
**Curso de muestra:** `CAMPUS_CURSO_355_1775833979` — "Diversidad, equidad e inclusión en el trabajo"
**Wrapper del proveedor:** `shared/scorm_api_1_2.js` (idéntico en ambos cursos CAMPUS)
**Fecha:** 2026-06-03

Esta matriz lista **cada elemento CMI observado** mientras el contenido de muestra
corría dentro del player, y cómo lo maneja la mutation `recordScormEvent`.

Todos los eventos se anexan a `lmsScormEvents` (log append-only). La columna
"Proyección" indica qué campos del agregado `lmsEnrollments` se actualizan.

## Elementos observados en vivo

| Elemento CMI | Dirección | Ejemplo de valor | Anexado a `lmsScormEvents` | Proyección a `lmsEnrollments` |
|---|---|---|---|---|
| `cmi.core.lesson_status` | SetValue | `incomplete`, `completed`, `passed`, `failed` | ✅ | `lessonStatus`; deriva `progressPercent` (ver tabla abajo); `passed`/`completed` ⇒ `status: "completed"` |
| `cmi.core.score.raw` | SetValue | `3` | ✅ | `scoreRaw` (parseado a número) |
| `cmi.core.score.min` | SetValue | `0` | ✅ | — (registrado; Sprint 1 lo usa para normalizar score) |
| `cmi.core.score.max` | SetValue | `8` | ✅ | — (registrado; Sprint 1 normaliza `scoreRaw/scoreMax`) |
| `cmi.core.exit` | SetValue | `suspend` | ✅ | — (registrado; señal de reanudación SCORM, sin efecto en agregado en Sprint 0) |
| `cmi.suspend_data` | SetValue | `{"done":[],"actual":8}` | ✅ | `suspendData` (string crudo, ≤ 4096 chars) |
| `cmi.core.session_time` | SetValue | `00:00:55.00` | ✅ | — (registrado; agregación de tiempo es Sprint 1) |
| `cmi.core.lesson_status` | GetValue | (lectura del LMS) | n/a | n/a (los GetValue no se persisten; scorm-again responde desde su CMI in-memory) |
| `cmi.suspend_data` | GetValue | (lectura del LMS) | n/a | n/a |

> **Nota sobre GetValue:** el wrapper del proveedor lee `cmi.core.lesson_status`
> y `cmi.suspend_data` al iniciar cada SCO para decidir si reanuda. `scorm-again`
> responde esas lecturas desde su modelo CMI in-memory (que se hidrata con lo que
> el contenido ya seteó en la sesión). No los persistimos como eventos porque son
> lecturas, no escrituras. La hidratación cross-sesión (reanudar desde
> `lmsEnrollments.suspendData` al reabrir) es trabajo de Sprint 1.

## Marcadores sintéticos (instrumentación del bridge)

Para preservar el límite de cada `LMSCommit` / `LMSFinish` en el log de auditoría,
el bridge anexa dos elementos sintéticos. No son elementos CMI del estándar; son
marcadores internos para agrupar y auditar.

| Marcador | Significado | Proyección |
|---|---|---|
| `__commit__` | Frontera de un `LMSCommit()`. Su valor es el `commitId` del grupo de SetValue previos. | ninguna |
| `__finish__` | `LMSFinish()` llamado (fin de sesión del SCO). Valor = timestamp ISO. | ninguna |

El campo `commitId` de cada fila de SetValue agrupa todos los SetValue que
pertenecen al mismo commit (`commit-0`, `commit-1`, …), de modo que el log es
reconstruible commit por commit.

## Derivación de `progressPercent` desde `lesson_status`

SCORM 1.2 **no tiene** una medida nativa de progreso (`cmi.progress_measure` es
SCORM 2004). Para el spike derivamos una señal gruesa de progreso desde
`lesson_status`:

| `lesson_status` | `progressPercent` |
|---|---|
| `passed` | 100 |
| `completed` | 100 |
| `failed` | 100 (se intentó hasta el final, pero no aprobó) |
| `incomplete` | 50 |
| `browsed` | 25 |
| `not attempted` | 0 |

La agregación de progreso real por-unidad (cuántos de los N SCOs de la
organización están `completed`) es trabajo de Sprint 1, cuando exista la
estructura completa de enrollment + tracking por SCO.

## Elementos del estándar SCORM 1.2 NO observados en este curso

El curso de muestra no escribe estos elementos, pero el modelo de eventos
append-only los captura sin cambios de código si un curso futuro los usa (la
proyección al agregado sí requeriría un `case` nuevo en `recordScormEvent`):

`cmi.core.student_id`, `cmi.core.student_name`, `cmi.core.credit`,
`cmi.core.entry`, `cmi.core.lesson_mode`, `cmi.core.total_time`,
`cmi.launch_data`, `cmi.comments`, `cmi.objectives.*`, `cmi.interactions.*`,
`cmi.student_data.mastery_score`, `cmi.student_preference.*`.

> `cmi.interactions.*` (respuestas pregunta-por-pregunta) es el candidato más
> probable para Sprint 1 si se quiere analítica de evaluación granular. El curso
> de muestra reporta solo el score agregado (`score.raw/min/max`), no las
> interacciones individuales.

## Verificación (AC-D03.7)

Verificado contra el curso SCORM 1.2 de muestra
(`scorm12_diversidad_equidad_e_inclusion.zip`). El segundo curso CAMPUS
("Gestión estratégica de la diversidad") comparte el **wrapper idéntico**
(`shared/scorm_api_1_2.js`), por lo que el pase de un curso es representativo del
mecanismo de bridge para ambos. El segundo curso no se stageó en este spike
(no estaba en `specs/.../fixtures/`); su identidad de wrapper hace el pase de un
solo curso suficiente para validar la apuesta técnica del PDD.
