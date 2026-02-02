# Implementation Plan: Zephyra Admin Dashboard

**Branch**: `001-zephyra-admin-dashboard` | **Date**: 2026-01-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-zephyra-admin-dashboard/spec.md`

## Summary

Construir un dashboard de administración para Zephyra Consultora que permita gestionar todo el contenido del sitio web (blog, equipo, proyectos, servicios, clientes, alianzas, newsletter) con autenticación segura, editor WYSIWYG avanzado, sistema de borradores, soft delete con papelera, y gestión de usuarios admin con roles.

**Enfoque técnico:** Next.js 16 con App Router, Server Components prioritarios, CSS Modules (sin Tailwind), Convex como base de datos reactiva, Resend para emails transaccionales, arquitectura feature-driven hipermodular.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20.9+
**Framework**: Next.js 16 (App Router, Server Components, Cache Components)
**Primary Dependencies**: Convex (database + file storage + auth), Resend (emails), React Email (templates)
**Storage**: Convex (document database + file storage integrado)
**Testing**: Vitest (unit), Playwright (e2e)
**Target Platform**: Web (Vercel deployment)
**Project Type**: Web application (single project - fullstack)
**Performance Goals**: Dashboard load < 3s, API responses < 200ms p95, real-time updates
**Constraints**: Máximo 5 admins concurrentes, imágenes < 5MB, sesiones expiran 30 min inactividad
**Scale/Scope**: ~5 administradores, ~100 artículos blog, ~20 proyectos, ~10 servicios

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Evidencia |
|-----------|--------|-----------|
| I. Calidad del Código | ✅ PASS | TypeScript strict, ESLint, Prettier, CSS Modules con convenciones |
| II. Estándares de Testing | ✅ PASS | Vitest para unit tests, Playwright para e2e, cobertura 80% crítico |
| III. Consistencia en UX | ✅ PASS | Design system con CSS variables, componentes reutilizables, estados definidos |
| IV. Documentación Exhaustiva | ✅ PASS | quickstart.md, contracts/, ADRs, README actualizado |
| V. Performance Óptima | ✅ PASS | Server Components, Convex real-time, lazy loading, image optimization |

**Gates adicionales:**
- ✅ Code reviews obligatorios (GitHub PR workflow)
- ✅ Secrets en variables de entorno (Convex env vars, Vercel)
- ✅ Input validation (Convex schema + Zod en cliente)
- ✅ OWASP considerado (auth, validation, rate limiting)

## Project Structure

### Documentation (this feature)

```text
specs/001-zephyra-admin-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (Convex schema + mutations/queries)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── app/                          # Next.js App Router (routes only)
│   ├── (public)/                 # Route group: sitio público
│   │   ├── page.tsx              # Home
│   │   ├── blog/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/page.tsx
│   │   ├── projects/
│   │   │   └── [slug]/page.tsx
│   │   └── layout.tsx
│   ├── (auth)/                   # Route group: autenticación
│   │   ├── login/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   ├── reset-password/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/              # Route group: admin dashboard
│   │   ├── admin/
│   │   │   ├── page.tsx          # Dashboard home
│   │   │   ├── blog/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── new/page.tsx
│   │   │   │   └── [id]/edit/page.tsx
│   │   │   ├── team/
│   │   │   ├── projects/
│   │   │   ├── services/
│   │   │   ├── clients/
│   │   │   ├── alliances/
│   │   │   ├── newsletter/
│   │   │   ├── users/            # Solo super-admin
│   │   │   └── trash/            # Papelera
│   │   └── layout.tsx
│   ├── api/                      # API routes (minimal - prefer Convex)
│   │   └── auth/
│   │       └── [...nextauth]/route.ts
│   ├── globals.css
│   └── layout.tsx
│
├── features/                     # Feature modules (business logic)
│   ├── auth/
│   │   ├── components/
│   │   │   ├── LoginForm/
│   │   │   ├── ForgotPasswordForm/
│   │   │   └── ResetPasswordForm/
│   │   ├── actions/
│   │   └── lib/
│   ├── blog/
│   │   ├── components/
│   │   │   ├── BlogList/
│   │   │   ├── BlogForm/
│   │   │   ├── BlogCard/
│   │   │   └── WysiwygEditor/
│   │   ├── actions/
│   │   └── types.ts
│   ├── team/
│   │   ├── components/
│   │   ├── actions/
│   │   └── types.ts
│   ├── projects/
│   ├── services/
│   ├── clients/
│   ├── alliances/
│   ├── newsletter/
│   ├── users/
│   ├── trash/
│   └── dashboard/
│       ├── components/
│       │   ├── Sidebar/
│       │   ├── Header/
│       │   ├── StatsCard/
│       │   └── QuickActions/
│       └── types.ts
│
├── components/                   # Shared UI components
│   ├── ui/
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.module.css
│   │   │   └── index.ts
│   │   ├── Input/
│   │   ├── Select/
│   │   ├── Modal/
│   │   ├── Table/
│   │   ├── Card/
│   │   ├── Toast/
│   │   ├── Skeleton/
│   │   ├── ImageUpload/
│   │   └── IconPicker/
│   └── layout/
│       ├── PublicLayout/
│       ├── AuthLayout/
│       └── DashboardLayout/
│
├── lib/                          # Shared utilities
│   ├── utils.ts
│   ├── cn.ts                     # classNames helper
│   └── constants.ts
│
├── providers/                    # React context providers
│   ├── ConvexProvider.tsx
│   └── ToastProvider.tsx
│
├── styles/                       # Global styles
│   ├── variables.css             # CSS custom properties
│   ├── reset.css
│   └── typography.css
│
├── emails/                       # React Email templates
│   └── PasswordReset.tsx
│
└── types/                        # Global TypeScript types
    └── index.ts

convex/                           # Convex backend
├── schema.ts                     # Database schema
├── _generated/                   # Auto-generated types
├── model/                        # Business logic helpers
│   ├── adminUsers.ts
│   ├── softDelete.ts
│   └── auth.ts
├── adminUsers.ts                 # Admin user mutations/queries
├── blogPosts.ts
├── teamMembers.ts
├── projects.ts
├── services.ts
├── clients.ts
├── alliances.ts
├── newsletter.ts
├── files.ts                      # File upload handling
└── stats.ts                      # Dashboard statistics

tests/
├── unit/
├── integration/
└── e2e/
    └── playwright/

public/
├── fonts/
└── icons/
```

**Structure Decision**: Single fullstack project con Next.js 16 + Convex. Feature-driven architecture con separación clara entre routes (app/), features (business logic), y components (UI compartido). Convex maneja todo el backend incluyendo auth, database, y file storage.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| WYSIWYG avanzado | Requerimiento explícito del spec (imágenes inline, tablas, video embeds) | Markdown/texto plano no cumple requisitos de usabilidad para usuarios no técnicos |
| Soft delete + papelera | Requerimiento del spec para recuperación de contenido eliminado por error | Hard delete no permite recuperar datos eliminados accidentalmente |
| Dos roles de admin | Requerimiento del spec (super-admin vs admin regular) | Rol único no permite gestión de usuarios segura |

## MCP Servers Configuration

Crear archivo `.mcp.json` en la raíz del proyecto:

```json
{
  "mcpServers": {
    "next-devtools": {
      "command": "npx",
      "args": ["-y", "next-devtools-mcp@latest"]
    },
    "convex": {
      "command": "npx",
      "args": ["convex", "mcp", "start"]
    },
    "vercel": {
      "type": "http",
      "url": "https://mcp.vercel.com"
    },
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/"
    }
  }
}
```

## Dependencies (Minimal)

### Production
```json
{
  "next": "^16.0.0",
  "react": "^19.2.0",
  "react-dom": "^19.2.0",
  "convex": "latest",
  "resend": "latest",
  "@react-email/components": "latest",
  "jose": "^5.0.0",
  "tiptap": "^2.0.0"
}
```

### Development
```json
{
  "typescript": "^5.0.0",
  "vitest": "latest",
  "playwright": "latest",
  "@types/react": "latest",
  "@types/node": "latest"
}
```

**Nota**: Tiptap es un editor WYSIWYG headless basado en ProseMirror que permite customización completa con CSS Modules.

## Code Conventions

### Arrow Functions para Componentes
```tsx
// ✅ Correcto
export const BlogCard = ({ post }: BlogCardProps) => {
  return <article>...</article>
}

// ❌ Incorrecto
export function BlogCard({ post }: BlogCardProps) {
  return <article>...</article>
}
```

### Funciones Normales para Pages
```tsx
// ✅ Correcto - pages usan function declaration
export default async function BlogPage() {
  return <div>...</div>
}

// ❌ Incorrecto para pages
export default async () => {
  return <div>...</div>
}
```

### Server Components por Defecto
```tsx
// ✅ Server Component (default) - sin 'use client'
export default async function TeamPage() {
  const members = await fetchQuery(api.teamMembers.list)
  return <TeamList members={members} />
}

// Solo agregar 'use client' cuando sea necesario (interactividad)
'use client'
export const EditButton = () => {
  const [isEditing, setIsEditing] = useState(false)
  // ...
}
```

## Next Steps

1. **Phase 0 Complete**: Ver `research.md` para decisiones técnicas detalladas
2. **Phase 1 Complete**: Ver `data-model.md`, `contracts/`, `quickstart.md`
3. **Siguiente**: Ejecutar `/speckit.tasks` para generar lista de tareas
