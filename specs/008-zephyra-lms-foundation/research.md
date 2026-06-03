# Research: Zephyra LMS — Foundation (Sprint 0)

**Date**: 2026-06-03
**Branch**: `feature/008-zephyra-lms-foundation`

## Resumen ejecutivo

Investigación técnica para fundar el LMS dentro del repo existente `zephyra-consultora`. La apuesta central (validada en el spike de Fase D) es que `scorm-again` puede servir un paquete SCORM 1.2 real de CAMPUS dentro de un iframe sandboxeado servido desde Convex `_storage`, y que las llamadas SCORM aterrizan en mutations de Convex.

## Referencias canónicas

Los documentos de planificación (PDD, SDD, sprint plan) los mantiene el equipo de Carbono14 fuera de este repo. Referencias por nombre + versión:

- **PDD v1.3** (`pdd-zephyra-lms`)
  - §6.3 — agregados e invariantes de las tablas `lms*` (fuente de los nombres de tabla e índices).
  - §7.1 — pipeline de ingestión SCORM (unzip en browser con JSZip → upload por archivo a `_storage` → parse de manifest en mutation).
  - §7.5 — auth (reuso de `adminUsers` + `jose`; learner auth nueva en Sprint 1).
  - Risk-INFRA / S0-R6 — riesgo de interacción de deploy de schema con el sitio institucional live.
- **SDD v3** (`sdd-SPRINT-ZEPHYRA-LMS-0`)
  - §3.1–3.7 — arquitectura del sprint (extensión de repo, schema subset, storage, deploy/CI, spike, auth dropeado, docs).
- **Sprint plan v3** (`sprint-plan-SPRINT-ZEPHYRA-LMS-0-v3`)

## 1. scorm-again (bridge SCORM)

### Decisión
Usar `scorm-again` v3.x como puente entre el contenido SCORM (que llama a `window.API` para SCORM 1.2 / `window.API_1484_11` para 2004) y nuestras mutations de Convex.

### Rationale
- Librería madura, mantenida, que implementa el data model SCORM 1.2 y 2004 del lado del LMS.
- Expone hooks (`LMSCommit`, `LMSSetValue`, etc.) que podemos interceptar para persistir en `lmsScormEvents` y proyectar a `lmsEnrollments`.
- El contenido de CAMPUS incluye su propio `scorm_api_1_2.js`, que busca `window.API` en la jerarquía de `window.parent` — `scorm-again` provee exactamente ese objeto.

### Repo
https://github.com/jcputney/scorm-again

## 2. Unzip en browser — JSZip

### Decisión
Usar **JSZip** para descomprimir el `.zip` SCORM en memoria del lado del cliente.

### Rationale
- El PDD §7.1 especifica explícitamente JSZip para el unzip en browser.
- API simple y probada (`loadAsync` → iterar entries → `async("blob")`), funciona en el browser sin polyfills de Node.
- El paquete de muestra pesa ~29 MB con una imagen de ~13 MB adentro; JSZip maneja ese tamaño en memoria sin problema.
- Permite filtrar archivos `.bak.*` antes del upload (limpieza de contenido CAMPUS).

### Alternativa considerada
`fflate` es más liviano y tree-shake-friendly. Se mantiene JSZip por alineación explícita con el PDD §7.1 y por su API de blobs más ergonómica para el flujo per-file-upload. Si el bundle del lado público se vuelve un problema en Sprint 1, `fflate` es el reemplazo natural.

## 3. Curso SCORM de muestra (fixture)

- Origen: `C:\Users\tomas\Downloads\Cursos Zephyra - copia\Cursos Nati\Curso Diversidad, Equidad e inclusión en el trabajo\scorm12_diversidad_equidad_e_inclusi_n_completo_1775833979.zip`
- Stageado en: `specs/008-zephyra-lms-foundation/fixtures/scorm12_diversidad_equidad_e_inclusion.zip`
- Tamaño: ~29 MB. SCORM 1.2. Versionado vía **Git LFS** (el repo tiene `git-lfs` instalado).
- Es el insumo del demo loop de la Fase D.

## 4. Auditoría (doc de referencia)

Las amendas del SDD v3 incorporan hallazgos de auditoría:
- C-1: el repo no tiene CI → se crea `.github/workflows/ci.yml` (Fase C).
- C-2: el deploy de Convex es **dev** (`exuberant-corgi-88`); Tomás verifica que exista antes del spawn.
- H-3: el fixture vive en `specs/008-.../fixtures/` (no en el workspace).
- H-4: `quickstart.md` se agrega al scaffolding de spec.
- M-1: la actualización de nav admin se pliega en Fase A.
- M-2: nota de estrategia de cookies (`session` admin vs `session-learner` futuro) en `quickstart.md`.

Las referencias de auditoría viven en los artefactos del SDD v3 / sprint plan v3 listados arriba.

## 5. Convex como motor de invariantes

Las mutations de Convex son ACID dentro de una ejecución de función. Esto cubre los invariantes de seats/enrollments del PDD §6.3 sin locks de Redis ni sagas a escala V1. En Fase A solo se persiste el subset (`lmsCourses`, `lmsScormEvents`, `lmsEnrollments`); el resto de los invariantes (seat-claim idempotency, etc.) llega en Sprint 1.
