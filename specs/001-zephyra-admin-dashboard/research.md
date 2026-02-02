# Research: Zephyra Admin Dashboard

**Date**: 2026-01-28
**Branch**: `001-zephyra-admin-dashboard`

## Executive Summary

Este documento consolida la investigación técnica para construir el admin dashboard de Zephyra Consultora usando Next.js 16, Convex, y Resend.

---

## 1. Next.js 16

### Decision
Usar Next.js 16 con App Router, Server Components por defecto, y CSS Modules.

### Rationale
- **Cache Components (`'use cache'`)**: Nueva directiva para control explícito de caché
- **proxy.ts reemplaza middleware.ts**: Mejor modelo de seguridad para auth
- **Turbopack por defecto**: 2-5x builds más rápidos
- **React 19.2**: View Transitions, useEffectEvent
- **Node.js 20.9+ requerido**

### Key Features para este proyecto

```tsx
// Cache Components para datos estáticos
export default async function ServicesPage() {
  'use cache'
  cacheTag('services')
  const services = await getServices()
  return <ServicesList services={services} />
}

// proxy.ts para protección de rutas
// proxy.ts
export default async function proxy(req: NextRequest) {
  const session = await getSession()
  if (req.nextUrl.pathname.startsWith('/admin') && !session) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }
  return NextResponse.next()
}
```

### Alternatives Considered
- **Next.js 15**: Rechazado - Usuario especificó explícitamente Next.js 16
- **Remix**: Rechazado - No solicitado, menor ecosistema

---

## 2. Database: Convex

### Decision
Usar Convex como base de datos, backend, y file storage.

### Rationale
- **Real-time por defecto**: Los cambios se reflejan instantáneamente (SC-003: <10 segundos)
- **TypeScript end-to-end**: Type safety desde schema hasta cliente
- **File storage integrado**: Simplifica upload de imágenes
- **Serverless**: Escala automáticamente, sin ops
- **Relaciones via ID references**: Patrón claro para relaciones

### Key Patterns

**Schema con soft delete:**
```typescript
defineTable({
  // ... campos
  deletedAt: v.optional(v.number()),
  deletedBy: v.optional(v.id("adminUsers")),
}).index("by_deleted", ["deletedAt"])
```

**Auth helpers:**
```typescript
export async function requireRole(ctx, roles) {
  const user = await getCurrentAdminUser(ctx)
  if (!roles.includes(user.role)) {
    throw new Error("Access denied")
  }
  return user
}
```

### Alternatives Considered
- **Prisma + PostgreSQL**: Rechazado - Requiere más setup, no tiene real-time nativo
- **Supabase**: Viable pero Convex fue especificado por el usuario
- **Firebase**: Rechazado - Vendor lock-in, modelo de datos menos flexible

---

## 3. Email: Resend

### Decision
Usar Resend para emails transaccionales (password reset).

### Rationale
- **API simple**: Una línea para enviar email
- **React Email**: Templates como componentes React
- **Rate limiting incluido**: 2 req/s default
- **Idempotency keys**: Previene duplicados en retry

### Implementation Pattern

```typescript
// emails/PasswordReset.tsx
import { Button, Html, Text } from '@react-email/components'

export const PasswordResetEmail = ({ resetToken }) => (
  <Html>
    <Text>Click to reset your password:</Text>
    <Button href={`${APP_URL}/reset-password?token=${resetToken}`}>
      Reset Password
    </Button>
    <Text>Link expires in 1 hour.</Text>
  </Html>
)

// lib/email.ts
import { Resend } from 'resend'
const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendPasswordResetEmail(to, token) {
  return resend.emails.send({
    from: 'Zephyra <noreply@zephyraconsultora.com>',
    to: [to],
    subject: 'Reset Your Password',
    react: PasswordResetEmail({ resetToken: token }),
  })
}
```

### Alternatives Considered
- **SendGrid**: Más complejo, overkill para emails transaccionales simples
- **Postmark**: Similar a Resend pero no especificado
- **AWS SES**: Requiere más configuración

---

## 4. WYSIWYG Editor: Tiptap

### Decision
Usar Tiptap para el editor de contenido del blog.

### Rationale
- **Headless**: Se puede estilizar completamente con CSS Modules
- **ProseMirror base**: Robusto y bien mantenido
- **Extensible**: Fácil agregar imágenes, tablas, video embeds
- **React integration**: Hooks nativos

### Extensions necesarias
```typescript
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Table from '@tiptap/extension-table'
import Youtube from '@tiptap/extension-youtube'
import Link from '@tiptap/extension-link'

const editor = useEditor({
  extensions: [
    StarterKit,
    Image,
    Table.configure({ resizable: true }),
    Youtube,
    Link.configure({ openOnClick: false }),
  ],
})
```

### Alternatives Considered
- **Slate.js**: Más bajo nivel, requiere más desarrollo
- **Quill**: Menos moderno, difícil de customizar estilos
- **Draft.js**: Abandonado por Meta
- **CKEditor/TinyMCE**: Comerciales, difícil quitar estilos default

---

## 5. CSS Strategy: CSS Modules

### Decision
CSS Modules sin Tailwind, con CSS custom properties para theming.

### Rationale
- **User requirement**: Explícitamente solicitado "sin Tailwind"
- **Scoped styles**: No conflictos de nombres
- **Co-location**: Estilos junto a componentes
- **CSS variables**: Theming centralizado

### Pattern

```css
/* styles/variables.css */
:root {
  --color-primary: #0066cc;
  --color-text: #1a1a1a;
  --color-text-secondary: #666;
  --color-bg: #ffffff;
  --color-bg-secondary: #f5f5f5;
  --color-border: #e5e5e5;
  --color-error: #dc2626;
  --color-success: #16a34a;

  --font-sans: system-ui, -apple-system, sans-serif;
  --font-mono: 'SF Mono', monospace;

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
}

/* Button/Button.module.css */
.button {
  font-family: var(--font-sans);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
}

.primary {
  background: var(--color-primary);
  color: white;
}

.primary:hover {
  filter: brightness(1.1);
}
```

---

## 6. Authentication Strategy

### Decision
Session-based auth con JWT tokens almacenados en HttpOnly cookies.

### Rationale
- **Convex auth integration**: Compatible con el modelo de auth de Convex
- **HttpOnly cookies**: Protección contra XSS
- **JWT con jose**: Librería liviana y moderna
- **30 min inactivity timeout**: Según spec

### Flow

1. **Login**: Validar credenciales → Crear JWT → Set cookie
2. **Request**: proxy.ts verifica cookie → Decode JWT → Attach user to request
3. **Convex**: `ctx.auth.getUserIdentity()` obtiene usuario desde token
4. **Logout**: Clear cookie
5. **Password Reset**: Generate token → Send email → Validate on reset

### Token Structure
```typescript
{
  sub: "user_id",
  email: "admin@zephyra.com",
  role: "superadmin",
  iat: 1234567890,
  exp: 1234571490 // 1 hour
}
```

---

## 7. File Upload Strategy

### Decision
Usar Convex Storage para todas las imágenes.

### Rationale
- **Integrado con Convex**: No requiere servicio adicional
- **URLs temporales**: Seguridad mejorada
- **Automatic cleanup**: Files huérfanos se pueden eliminar

### Flow

1. Cliente solicita upload URL via mutation
2. Cliente POSTea archivo a URL
3. Servidor retorna storageId
4. storageId se guarda en documento
5. Query obtiene URL pública cuando se necesita mostrar

### Image Optimization
Next.js Image component manejará optimización en el render:
```tsx
<Image
  src={await ctx.storage.getUrl(storageId)}
  alt={alt}
  width={800}
  height={400}
  sizes="(max-width: 768px) 100vw, 800px"
/>
```

---

## 8. MCP Servers

### Decision
Integrar 4 MCP servers para desarrollo asistido por AI.

### Configuration (.mcp.json)

| Server | Purpose | URL/Command |
|--------|---------|-------------|
| next-devtools | Error detection, logs, metadata | `npx next-devtools-mcp@latest` |
| convex | Database inspection, function execution | `npx convex mcp start` |
| vercel | Deployment management, docs search | `https://mcp.vercel.com` |
| github | Repository management, PRs, issues | `https://api.githubcopilot.com/mcp/` |

### Usage
- **Development**: next-devtools para debugging, convex para DB
- **Deployment**: vercel para deploy, github para PRs
- **Documentation**: vercel y next-devtools para consultas

---

## 9. Testing Strategy

### Decision
Vitest para unit tests, Playwright para e2e.

### Rationale
- **Vitest**: Compatible con Vite/Next.js, rápido, modern
- **Playwright**: Cross-browser, reliable, Vercel integración

### Coverage Targets (per Constitution)
- 80% para código crítico de negocio (auth, mutations)
- 60% para código general (UI components)

### Test Structure
```
tests/
├── unit/
│   ├── features/
│   │   ├── blog/
│   │   └── auth/
│   └── components/
├── integration/
│   └── convex/
└── e2e/
    └── playwright/
        ├── auth.spec.ts
        ├── blog.spec.ts
        └── dashboard.spec.ts
```

---

## 10. Deployment Strategy

### Decision
Deploy a Vercel con Convex como backend.

### Rationale
- **Vercel**: Óptimo para Next.js, preview deployments, edge
- **Convex**: Managed backend, no ops

### Environment Variables
```
# Vercel
NEXT_PUBLIC_CONVEX_URL=https://xxx.convex.cloud
CONVEX_DEPLOY_KEY=xxx
RESEND_API_KEY=re_xxx
SESSION_SECRET=xxx
NEXT_PUBLIC_APP_URL=https://zephyraconsultora.com
```

---

## Summary of Technical Decisions

| Area | Decision | Key Library |
|------|----------|-------------|
| Framework | Next.js 16 App Router | `next@^16` |
| Database | Convex | `convex` |
| Styling | CSS Modules + CSS Variables | Built-in |
| WYSIWYG | Tiptap | `@tiptap/react` |
| Email | Resend | `resend` |
| Auth | JWT + HttpOnly cookies | `jose` |
| Testing | Vitest + Playwright | `vitest`, `playwright` |
| Deploy | Vercel + Convex | - |
