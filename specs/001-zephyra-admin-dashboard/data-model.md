# Data Model: Zephyra Admin Dashboard

**Date**: 2026-01-28
**Branch**: `001-zephyra-admin-dashboard`

## Overview

Este documento define el modelo de datos para el admin dashboard usando Convex. Todas las tablas incluyen campos de soft delete para la funcionalidad de papelera.

---

## Entity Relationship Diagram

```
┌─────────────────┐
│   AdminUser     │
├─────────────────┤
│ _id             │──────────────────────────────┐
│ email           │                              │
│ name            │                              │
│ passwordHash    │                              │
│ role            │                              │
│ avatarStorageId │───┐                          │
│ isActive        │   │                          │
│ lastLoginAt     │   │                          │
│ deletedAt       │   │                          │
│ deletedBy       │───┼──────────────────────────┘
└─────────────────┘   │
                      │
┌─────────────────┐   │   ┌─────────────────┐
│   BlogPost      │   │   │  TeamMember     │
├─────────────────┤   │   ├─────────────────┤
│ _id             │   │   │ _id             │
│ title           │   │   │ name            │
│ slug            │   │   │ role            │
│ excerpt         │   │   │ specialty       │
│ content (HTML)  │   │   │ imageStorageId  │───┐
│ coverStorageId  │───┤   │ displayOrder    │   │
│ authorId        │───┼───│ isVisible       │   │
│ status          │   │   │ deletedAt       │   │
│ publishedAt     │   │   │ deletedBy       │   │
│ deletedAt       │   │   └─────────────────┘   │
│ deletedBy       │   │                         │
└─────────────────┘   │   ┌─────────────────┐   │
                      │   │    Project      │   │
┌─────────────────┐   │   ├─────────────────┤   │
│    Service      │   │   │ _id             │   │
├─────────────────┤   │   │ title           │   │
│ _id             │   │   │ slug            │   │
│ title           │   │   │ description     │   │
│ description     │   │   │ excerpt         │   │
│ iconName        │   │   │ imageStorageId  │───┤
│ displayOrder    │   │   │ displayOrder    │   │
│ isActive        │   │   │ isFeatured      │   │
│ deletedAt       │   │   │ deletedAt       │   │
│ deletedBy       │   │   │ deletedBy       │   │
└─────────────────┘   │   └────────┬────────┘   │
                      │            │            │
┌─────────────────┐   │   ┌────────▼────────┐   │
│     Client      │   │   │ ProjectAchieve  │   │
├─────────────────┤   │   ├─────────────────┤   │
│ _id             │   │   │ _id             │   │
│ name            │   │   │ projectId       │───┘
│ logoStorageId   │───┤   │ description     │
│ websiteUrl      │   │   │ displayOrder    │
│ displayOrder    │   │   └─────────────────┘
│ deletedAt       │   │
│ deletedBy       │   │   ┌─────────────────┐
└─────────────────┘   │   │    Alliance     │
                      │   ├─────────────────┤
┌─────────────────┐   │   │ _id             │
│  Newsletter     │   │   │ name            │
├─────────────────┤   │   │ logoStorageId   │───┘
│ _id             │       │ websiteUrl      │
│ email           │       │ displayOrder    │
│ subscribedAt    │       │ deletedAt       │
│ isActive        │       │ deletedBy       │
│ unsubscribedAt  │       └─────────────────┘
└─────────────────┘

┌─────────────────┐
│  PasswordReset  │
├─────────────────┤
│ _id             │
│ adminUserId     │
│ token           │
│ expiresAt       │
│ usedAt          │
└─────────────────┘
```

---

## Entities Detail

### AdminUser

Administrador del sistema con roles diferenciados.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | Id<"adminUsers"> | Auto | Identificador único |
| email | string | Yes | Email único para login |
| name | string | Yes | Nombre para mostrar |
| passwordHash | string | Yes | Contraseña hasheada (bcrypt) |
| role | "superadmin" \| "admin" | Yes | Rol del usuario |
| avatarStorageId | Id<"_storage"> | No | Imagen de perfil |
| isActive | boolean | Yes | Si puede acceder al sistema |
| lastLoginAt | number | No | Timestamp último login |
| createdAt | number | Yes | Timestamp creación |
| deletedAt | number | No | Timestamp soft delete |
| deletedBy | Id<"adminUsers"> | No | Quién eliminó |

**Indexes:**
- `by_email`: [email] - Login lookup
- `by_role`: [role] - Filter by role
- `by_deleted`: [deletedAt] - Trash queries

**Validation Rules:**
- Email: formato válido, único en sistema
- Password: mínimo 8 caracteres, hasheado
- Role: solo "superadmin" puede crear otros admins

---

### BlogPost

Artículo del blog con soporte para borradores.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | Id<"blogPosts"> | Auto | Identificador único |
| title | string | Yes | Título del artículo |
| slug | string | Yes | URL-friendly identifier, único |
| excerpt | string | Yes | Resumen para listados |
| content | string | Yes | HTML del editor WYSIWYG |
| coverStorageId | Id<"_storage"> | No | Imagen de portada |
| authorId | Id<"teamMembers"> | Yes | Autor (del equipo) |
| status | "draft" \| "published" | Yes | Estado de publicación |
| publishedAt | number | No | Timestamp publicación |
| createdAt | number | Yes | Timestamp creación |
| updatedAt | number | Yes | Timestamp última edición |
| deletedAt | number | No | Timestamp soft delete |
| deletedBy | Id<"adminUsers"> | No | Quién eliminó |

**Indexes:**
- `by_slug`: [slug] - URL lookup
- `by_status`: [status] - Filter by status
- `by_status_published`: [status, publishedAt] - Public listing
- `by_author`: [authorId] - Posts by author
- `by_deleted`: [deletedAt] - Trash queries

**State Transitions:**
```
draft ──publish──> published
  ↑                    │
  └───unpublish────────┘
```

**Validation Rules:**
- Slug: único, URL-safe (lowercase, hyphens)
- publishedAt: set automáticamente al publicar
- authorId: debe existir en teamMembers

---

### TeamMember

Miembro del equipo de Zephyra.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | Id<"teamMembers"> | Auto | Identificador único |
| name | string | Yes | Nombre completo |
| role | string | Yes | Cargo (ej: "Cofundadora") |
| specialty | string | Yes | Especialidad profesional |
| imageStorageId | Id<"_storage"> | No | Foto de perfil |
| displayOrder | number | Yes | Orden en carrusel |
| isVisible | boolean | Yes | Si se muestra en sitio público |
| deletedAt | number | No | Timestamp soft delete |
| deletedBy | Id<"adminUsers"> | No | Quién eliminó |

**Indexes:**
- `by_order`: [displayOrder] - Sorted listing
- `by_visible_order`: [isVisible, displayOrder] - Public listing
- `by_deleted`: [deletedAt] - Trash queries

**Validation Rules:**
- No se puede eliminar si es autor de BlogPosts activos (mostrar warning y opción de reasignar)

---

### Project

Proyecto o caso de éxito.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | Id<"projects"> | Auto | Identificador único |
| title | string | Yes | Título del proyecto |
| slug | string | Yes | URL-friendly identifier |
| description | string | Yes | Descripción completa |
| excerpt | string | Yes | Resumen para listados |
| imageStorageId | Id<"_storage"> | No | Imagen principal |
| displayOrder | number | Yes | Orden en listado |
| isFeatured | boolean | Yes | Si está destacado |
| createdAt | number | Yes | Timestamp creación |
| updatedAt | number | Yes | Timestamp última edición |
| deletedAt | number | No | Timestamp soft delete |
| deletedBy | Id<"adminUsers"> | No | Quién eliminó |

**Indexes:**
- `by_slug`: [slug] - URL lookup
- `by_order`: [displayOrder] - Sorted listing
- `by_featured`: [isFeatured, displayOrder] - Featured projects
- `by_deleted`: [deletedAt] - Trash queries

---

### ProjectAchievement

Logro dentro de un proyecto.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | Id<"projectAchievements"> | Auto | Identificador único |
| projectId | Id<"projects"> | Yes | Proyecto padre |
| description | string | Yes | Texto del logro |
| displayOrder | number | Yes | Orden en lista |

**Indexes:**
- `by_project`: [projectId] - Get achievements for project
- `by_project_order`: [projectId, displayOrder] - Ordered list

**Cascade:** Se eliminan al eliminar el proyecto padre.

---

### Service

Servicio ofrecido por la consultora.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | Id<"services"> | Auto | Identificador único |
| title | string | Yes | Nombre del servicio |
| description | string | Yes | Descripción completa |
| iconName | string | Yes | Nombre del icono (Material Icons) |
| displayOrder | number | Yes | Orden en carrusel |
| isActive | boolean | Yes | Si se muestra en sitio |
| deletedAt | number | No | Timestamp soft delete |
| deletedBy | Id<"adminUsers"> | No | Quién eliminó |

**Indexes:**
- `by_order`: [displayOrder] - Sorted listing
- `by_active_order`: [isActive, displayOrder] - Public listing
- `by_deleted`: [deletedAt] - Trash queries

---

### Client

Empresa cliente de Zephyra.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | Id<"clients"> | Auto | Identificador único |
| name | string | Yes | Nombre de la empresa |
| logoStorageId | Id<"_storage"> | No | Logo de la empresa |
| websiteUrl | string | No | URL del sitio web |
| displayOrder | number | Yes | Orden en listado |
| deletedAt | number | No | Timestamp soft delete |
| deletedBy | Id<"adminUsers"> | No | Quién eliminó |

**Indexes:**
- `by_order`: [displayOrder] - Sorted listing
- `by_deleted`: [deletedAt] - Trash queries

---

### Alliance

Organización aliada de Zephyra.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | Id<"alliances"> | Auto | Identificador único |
| name | string | Yes | Nombre de la organización |
| logoStorageId | Id<"_storage"> | No | Logo de la organización |
| websiteUrl | string | No | URL del sitio web |
| displayOrder | number | Yes | Orden en listado |
| deletedAt | number | No | Timestamp soft delete |
| deletedBy | Id<"adminUsers"> | No | Quién eliminó |

**Indexes:**
- `by_order`: [displayOrder] - Sorted listing
- `by_deleted`: [deletedAt] - Trash queries

---

### NewsletterSubscriber

Suscriptor del newsletter.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | Id<"newsletterSubscribers"> | Auto | Identificador único |
| email | string | Yes | Email único |
| subscribedAt | number | Yes | Timestamp suscripción |
| isActive | boolean | Yes | Si está activo |
| unsubscribedAt | number | No | Timestamp desuscripción |

**Indexes:**
- `by_email`: [email] - Lookup/dedup
- `by_active`: [isActive] - Export activos
- `by_subscribed`: [subscribedAt] - Sorted listing

**Note:** No tiene soft delete - se marca como inactivo.

---

### PasswordResetToken

Token temporal para reset de contraseña.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | Id<"passwordResetTokens"> | Auto | Identificador único |
| adminUserId | Id<"adminUsers"> | Yes | Usuario asociado |
| token | string | Yes | Token hash único |
| expiresAt | number | Yes | Timestamp expiración (1 hora) |
| usedAt | number | No | Timestamp uso |

**Indexes:**
- `by_token`: [token] - Token lookup
- `by_user`: [adminUserId] - Clean up old tokens

**Validation Rules:**
- Token hasheado en DB
- Solo puede usarse una vez (usedAt != null = inválido)
- Expira en 1 hora

---

## Soft Delete Pattern

Todas las tablas principales implementan soft delete:

```typescript
// Schema fields
deletedAt: v.optional(v.number()),
deletedBy: v.optional(v.id("adminUsers")),

// Index for trash queries
.index("by_deleted", ["deletedAt"])

// Query pattern - exclude deleted
const items = await ctx.db
  .query("blogPosts")
  .filter((q) => q.eq(q.field("deletedAt"), undefined))
  .collect()

// Query pattern - only deleted (trash)
const trashedItems = await ctx.db
  .query("blogPosts")
  .withIndex("by_deleted")
  .filter((q) => q.neq(q.field("deletedAt"), undefined))
  .collect()

// Soft delete mutation
await ctx.db.patch(id, {
  deletedAt: Date.now(),
  deletedBy: currentUserId,
})

// Restore mutation
await ctx.db.patch(id, {
  deletedAt: undefined,
  deletedBy: undefined,
})

// Permanent delete (30 days logic via scheduled job)
await ctx.db.delete(id)
```

---

## Scheduled Jobs

### Permanent Delete Cleanup

Eliminar permanentemente items en papelera después de 30 días:

```typescript
// convex/crons.ts
import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()

crons.daily(
  "cleanup-trash",
  { hourUTC: 3, minuteUTC: 0 }, // 3 AM UTC daily
  internal.trash.permanentDeleteExpired
)

export default crons
```

```typescript
// convex/trash.ts
export const permanentDeleteExpired = internalMutation({
  handler: async (ctx) => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000

    const tables = [
      "blogPosts", "teamMembers", "projects",
      "services", "clients", "alliances"
    ]

    for (const table of tables) {
      const expired = await ctx.db
        .query(table)
        .withIndex("by_deleted")
        .filter((q) =>
          q.and(
            q.neq(q.field("deletedAt"), undefined),
            q.lt(q.field("deletedAt"), thirtyDaysAgo)
          )
        )
        .collect()

      for (const item of expired) {
        // Delete associated files
        if (item.coverStorageId) await ctx.storage.delete(item.coverStorageId)
        if (item.imageStorageId) await ctx.storage.delete(item.imageStorageId)
        if (item.logoStorageId) await ctx.storage.delete(item.logoStorageId)

        // Delete associated achievements (for projects)
        if (table === "projects") {
          const achievements = await ctx.db
            .query("projectAchievements")
            .withIndex("by_project", (q) => q.eq("projectId", item._id))
            .collect()
          for (const a of achievements) await ctx.db.delete(a._id)
        }

        await ctx.db.delete(item._id)
      }
    }
  },
})
```
