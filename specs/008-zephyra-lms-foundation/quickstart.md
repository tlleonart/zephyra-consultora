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
