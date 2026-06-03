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

## 3. Demo loop del spike SCORM (stub — se completa en Fase D)

> **Estado:** stub. El flujo completo (unzip en browser → upload por archivo a Convex `_storage` → parse de manifest → ingest a `lmsCourses` → player en iframe → bridge `scorm-again` → `recordScormEvent` → proyección a `lmsEnrollments`) se implementa en la **Fase D**.

Pasos previstos del demo loop (a completar en Fase D):

1. En `/admin/lms`, seleccionar el `.zip` SCORM de muestra (`specs/008-zephyra-lms-foundation/fixtures/scorm12_diversidad_equidad_e_inclusion.zip`).
2. El cliente lo descomprime en memoria (JSZip), filtra `.bak.*`, y sube cada archivo a Convex `_storage`.
3. Una mutation parsea `imsmanifest.xml` y crea la fila `lmsCourses` (`status: "draft"`).
4. Abrir `/cursos/<slug>/player` → el iframe sandboxeado carga el entry point del SCO.
5. El contenido encuentra `window.API` (provisto por `scorm-again`) y emite llamadas SCORM 1.2.
6. Cada `LMSSetValue` / `LMSCommit` se persiste en `lmsScormEvents` (append-only) y proyecta a `lmsEnrollments` (`progressPercent`, `scoreRaw`, `lessonStatus`, `suspendData`).
7. **Verificación:** en el Convex dashboard (dev), al navegar unidades se ven filas nuevas en `lmsScormEvents` Y cambian `lmsEnrollments.lessonStatus` / `.scoreRaw`.

Objetivo de reproducibilidad (SDD v3): un teammate reproduce el demo desde un clone limpio en <15 min.

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
