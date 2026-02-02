# Quickstart: Zephyra Admin Dashboard

**Date**: 2026-01-28
**Branch**: `001-zephyra-admin-dashboard`

## Prerequisites

- Node.js 20.9+
- npm or pnpm
- Git
- Cuenta Convex (gratis): https://convex.dev
- Cuenta Resend (gratis): https://resend.com
- (Opcional) Cuenta Vercel para deploy

---

## 1. Setup Inicial

### Clone y dependencias

```bash
# Clone el repo
git clone <repo-url>
cd zephyra-consultora
git checkout 001-zephyra-admin-dashboard

# Instalar dependencias
npm install
```

### Crear proyecto Next.js 16

Si es un proyecto nuevo:

```bash
npx create-next-app@latest . --typescript --app --no-tailwind --no-eslint
```

### Instalar dependencias del proyecto

```bash
# Core
npm install convex resend @react-email/components jose

# WYSIWYG Editor
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-image @tiptap/extension-table @tiptap/extension-youtube @tiptap/extension-link

# Dev
npm install -D typescript @types/react @types/node vitest playwright
```

---

## 2. Configurar Convex

### Inicializar Convex

```bash
npx convex dev
```

Esto te pedirá:
1. Crear cuenta o login
2. Crear nuevo proyecto o seleccionar existente
3. Generará archivos en `convex/`

### Copiar schema

```bash
cp specs/001-zephyra-admin-dashboard/contracts/convex-schema.ts convex/schema.ts
```

### Configurar variables de entorno

Crear `.env.local`:

```env
# Convex (auto-generated por npx convex dev)
CONVEX_DEPLOYMENT=dev:xxx
NEXT_PUBLIC_CONVEX_URL=https://xxx.convex.cloud

# Resend
RESEND_API_KEY=re_xxxxxxxxx

# Auth
SESSION_SECRET=tu-secret-de-32-caracteres-minimo

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 3. Configurar MCP Servers

Crear `.mcp.json` en la raíz:

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

---

## 4. Estructura de Archivos Base

Crear la estructura de directorios:

```bash
mkdir -p src/app/\(public\)
mkdir -p src/app/\(auth\)/{login,forgot-password,reset-password}
mkdir -p src/app/\(dashboard\)/admin/{blog,team,projects,services,clients,alliances,newsletter,users,trash}
mkdir -p src/features/{auth,blog,team,projects,services,clients,alliances,newsletter,users,trash,dashboard}/components
mkdir -p src/components/ui/{Button,Input,Select,Modal,Table,Card,Toast,Skeleton,ImageUpload,IconPicker}
mkdir -p src/components/layout/{PublicLayout,AuthLayout,DashboardLayout}
mkdir -p src/lib
mkdir -p src/providers
mkdir -p src/styles
mkdir -p src/emails
mkdir -p convex/model
mkdir -p tests/{unit,integration,e2e/playwright}
mkdir -p public/{fonts,icons}
```

---

## 5. Archivos Iniciales

### `src/app/layout.tsx`

```tsx
import './globals.css'
import { ConvexProvider } from '@/providers/ConvexProvider'

export const metadata = {
  title: 'Zephyra Consultora',
  description: 'Consultora de sostenibilidad e impacto social',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>
        <ConvexProvider>{children}</ConvexProvider>
      </body>
    </html>
  )
}
```

### `src/providers/ConvexProvider.tsx`

```tsx
'use client'

import { ConvexProvider as BaseConvexProvider, ConvexReactClient } from 'convex/react'
import { ReactNode } from 'react'

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export const ConvexProvider = ({ children }: { children: ReactNode }) => {
  return (
    <BaseConvexProvider client={convex}>
      {children}
    </BaseConvexProvider>
  )
}
```

### `src/styles/variables.css`

```css
:root {
  /* Colors */
  --color-primary: #0066cc;
  --color-primary-hover: #0052a3;
  --color-secondary: #6b7280;
  --color-success: #16a34a;
  --color-error: #dc2626;
  --color-warning: #f59e0b;

  /* Text */
  --color-text: #1a1a1a;
  --color-text-secondary: #6b7280;
  --color-text-muted: #9ca3af;

  /* Background */
  --color-bg: #ffffff;
  --color-bg-secondary: #f9fafb;
  --color-bg-tertiary: #f3f4f6;

  /* Border */
  --color-border: #e5e7eb;
  --color-border-focus: var(--color-primary);

  /* Typography */
  --font-sans: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'SF Mono', SFMono-Regular, ui-monospace, monospace;

  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-2xl: 48px;

  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;

  /* Z-index */
  --z-dropdown: 100;
  --z-modal: 200;
  --z-toast: 300;
}
```

### `src/app/globals.css`

```css
@import './styles/variables.css';

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: var(--font-sans);
  color: var(--color-text);
  background-color: var(--color-bg);
  line-height: 1.5;
}

a {
  color: inherit;
  text-decoration: none;
}

button {
  font-family: inherit;
  cursor: pointer;
}

input,
textarea,
select {
  font-family: inherit;
  font-size: inherit;
}

img {
  max-width: 100%;
  height: auto;
}
```

### `proxy.ts` (raíz del proyecto)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const secretKey = new TextEncoder().encode(process.env.SESSION_SECRET)

const protectedRoutes = ['/admin']
const authRoutes = ['/login', '/forgot-password', '/reset-password']

export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Check if route needs protection
  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route))
  const isAuthRoute = authRoutes.some(route => path.startsWith(route))

  // Get session cookie
  const sessionCookie = request.cookies.get('session')?.value

  let isAuthenticated = false
  if (sessionCookie) {
    try {
      await jwtVerify(sessionCookie, secretKey)
      isAuthenticated = true
    } catch {
      // Invalid or expired token
    }
  }

  // Redirect unauthenticated users from protected routes
  if (isProtectedRoute && !isAuthenticated) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect authenticated users from auth routes
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
```

---

## 6. Seed Data (Opcional)

Crear super-admin inicial en Convex:

```typescript
// convex/seed.ts
import { internalMutation } from "./_generated/server";
import { hash } from "bcryptjs"; // npm install bcryptjs @types/bcryptjs

export const seedSuperAdmin = internalMutation({
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("adminUsers")
      .withIndex("by_email", (q) => q.eq("email", "admin@zephyraconsultora.com"))
      .first();

    if (existing) {
      console.log("Super admin already exists");
      return;
    }

    const passwordHash = await hash("changeme123", 10);

    await ctx.db.insert("adminUsers", {
      email: "admin@zephyraconsultora.com",
      name: "Super Admin",
      passwordHash,
      role: "superadmin",
      isActive: true,
      createdAt: Date.now(),
    });

    console.log("Super admin created successfully");
  },
});
```

Ejecutar desde Convex dashboard o CLI:
```bash
npx convex run seed:seedSuperAdmin
```

---

## 7. Ejecutar en Desarrollo

### Terminal 1: Convex dev server

```bash
npx convex dev
```

### Terminal 2: Next.js dev server

```bash
npm run dev
```

### Acceder

- **Sitio público**: http://localhost:3000
- **Login**: http://localhost:3000/login
- **Dashboard**: http://localhost:3000/admin (requiere login)

---

## 8. Verificar Setup

### Checklist

- [ ] `npm run dev` inicia sin errores
- [ ] `npx convex dev` conecta al proyecto
- [ ] Convex Dashboard muestra las tablas del schema
- [ ] `.env.local` tiene todas las variables
- [ ] MCP servers configurados en `.mcp.json`
- [ ] CSS variables funcionan (verificar en DevTools)
- [ ] proxy.ts redirige a /login desde /admin

---

## 9. Próximos Pasos

1. Ejecutar `/speckit.tasks` para generar lista de tareas de implementación
2. Implementar features en orden de prioridad (P1 → P2 → P3)
3. Seguir convenciones de código definidas en `plan.md`

---

## Troubleshooting

### Error: "Convex deployment not found"

```bash
# Re-inicializar Convex
npx convex dev --once
```

### Error: "Module not found: convex/_generated"

```bash
# Regenerar tipos
npx convex codegen
```

### Error: "Invalid environment variable"

Verificar que `.env.local` existe y tiene los valores correctos. Reiniciar dev server después de cambios.

### Error: "proxy.ts not working"

Next.js 16 usa `proxy.ts` en lugar de `middleware.ts`. Verificar que el archivo está en la raíz del proyecto, no en `src/`.
