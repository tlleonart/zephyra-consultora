# API Contracts: Zephyra Admin Dashboard

**Date**: 2026-01-28
**Branch**: `001-zephyra-admin-dashboard`

Este documento define las queries y mutations de Convex para el admin dashboard.

---

## Authentication

### `adminUsers.login`
**Type**: Mutation (public)

```typescript
args: {
  email: v.string(),
  password: v.string(),
}
returns: {
  success: boolean,
  token?: string,
  error?: string,
}
```

### `adminUsers.logout`
**Type**: Mutation (authenticated)

```typescript
args: {}
returns: { success: boolean }
```

### `adminUsers.getCurrentUser`
**Type**: Query (authenticated)

```typescript
args: {}
returns: AdminUser | null
```

### `adminUsers.requestPasswordReset`
**Type**: Mutation (public)

```typescript
args: {
  email: v.string(),
}
returns: { success: boolean } // Always true to prevent enumeration
```

### `adminUsers.resetPassword`
**Type**: Mutation (public)

```typescript
args: {
  token: v.string(),
  newPassword: v.string(),
}
returns: {
  success: boolean,
  error?: string,
}
```

---

## Admin Users (super-admin only)

### `adminUsers.list`
**Type**: Query

```typescript
args: {
  includeDeleted?: boolean,
}
returns: AdminUser[]
```

### `adminUsers.create`
**Type**: Mutation

```typescript
args: {
  email: v.string(),
  name: v.string(),
  password: v.string(),
  role: "superadmin" | "admin",
}
returns: Id<"adminUsers">
```

### `adminUsers.update`
**Type**: Mutation

```typescript
args: {
  id: v.id("adminUsers"),
  name?: v.string(),
  role?: "superadmin" | "admin",
  isActive?: v.boolean(),
}
returns: void
```

### `adminUsers.delete`
**Type**: Mutation (soft delete)

```typescript
args: {
  id: v.id("adminUsers"),
}
returns: void
// Error if trying to delete self
```

---

## Blog Posts

### `blogPosts.list`
**Type**: Query (authenticated)

```typescript
args: {
  status?: "draft" | "published",
  limit?: v.number(),
  cursor?: v.string(),
}
returns: {
  posts: BlogPost[],
  nextCursor?: string,
}
```

### `blogPosts.listPublished`
**Type**: Query (public)

```typescript
args: {
  limit?: v.number(),
  cursor?: v.string(),
}
returns: {
  posts: BlogPost[],
  nextCursor?: string,
}
```

### `blogPosts.getBySlug`
**Type**: Query (public)

```typescript
args: {
  slug: v.string(),
}
returns: BlogPost | null
```

### `blogPosts.getById`
**Type**: Query (authenticated)

```typescript
args: {
  id: v.id("blogPosts"),
}
returns: BlogPost | null
```

### `blogPosts.create`
**Type**: Mutation

```typescript
args: {
  title: v.string(),
  slug: v.string(),
  excerpt: v.string(),
  content: v.string(),
  coverStorageId?: v.id("_storage"),
  authorId: v.id("teamMembers"),
  status: "draft" | "published",
}
returns: Id<"blogPosts">
// Error if slug not unique
```

### `blogPosts.update`
**Type**: Mutation

```typescript
args: {
  id: v.id("blogPosts"),
  title?: v.string(),
  slug?: v.string(),
  excerpt?: v.string(),
  content?: v.string(),
  coverStorageId?: v.id("_storage"),
  authorId?: v.id("teamMembers"),
  status?: "draft" | "published",
}
returns: void
```

### `blogPosts.publish`
**Type**: Mutation

```typescript
args: {
  id: v.id("blogPosts"),
}
returns: void
// Sets status to "published" and publishedAt to now
```

### `blogPosts.unpublish`
**Type**: Mutation

```typescript
args: {
  id: v.id("blogPosts"),
}
returns: void
// Sets status to "draft"
```

### `blogPosts.delete`
**Type**: Mutation (soft delete)

```typescript
args: {
  id: v.id("blogPosts"),
}
returns: void
```

---

## Team Members

### `teamMembers.list`
**Type**: Query (authenticated)

```typescript
args: {
  includeHidden?: boolean,
}
returns: TeamMember[]
```

### `teamMembers.listPublic`
**Type**: Query (public)

```typescript
args: {}
returns: TeamMember[] // Only visible, ordered
```

### `teamMembers.getById`
**Type**: Query (authenticated)

```typescript
args: {
  id: v.id("teamMembers"),
}
returns: TeamMember | null
```

### `teamMembers.create`
**Type**: Mutation

```typescript
args: {
  name: v.string(),
  role: v.string(),
  specialty: v.string(),
  imageStorageId?: v.id("_storage"),
  displayOrder: v.number(),
  isVisible: v.boolean(),
}
returns: Id<"teamMembers">
```

### `teamMembers.update`
**Type**: Mutation

```typescript
args: {
  id: v.id("teamMembers"),
  name?: v.string(),
  role?: v.string(),
  specialty?: v.string(),
  imageStorageId?: v.id("_storage"),
  displayOrder?: v.number(),
  isVisible?: v.boolean(),
}
returns: void
```

### `teamMembers.reorder`
**Type**: Mutation

```typescript
args: {
  orderedIds: v.array(v.id("teamMembers")),
}
returns: void
```

### `teamMembers.delete`
**Type**: Mutation (soft delete)

```typescript
args: {
  id: v.id("teamMembers"),
}
returns: void
// Error if has associated blog posts (provide reassignment option)
```

### `teamMembers.canDelete`
**Type**: Query

```typescript
args: {
  id: v.id("teamMembers"),
}
returns: {
  canDelete: boolean,
  blogPostCount: number,
}
```

---

## Projects

### `projects.list`
**Type**: Query (authenticated)

```typescript
args: {}
returns: Project[] // With achievements
```

### `projects.listPublic`
**Type**: Query (public)

```typescript
args: {}
returns: Project[] // With achievements, ordered
```

### `projects.getBySlug`
**Type**: Query (public)

```typescript
args: {
  slug: v.string(),
}
returns: Project | null // With achievements
```

### `projects.create`
**Type**: Mutation

```typescript
args: {
  title: v.string(),
  slug: v.string(),
  description: v.string(),
  excerpt: v.string(),
  imageStorageId?: v.id("_storage"),
  displayOrder: v.number(),
  isFeatured: v.boolean(),
  achievements: v.array(v.object({
    description: v.string(),
    displayOrder: v.number(),
  })),
}
returns: Id<"projects">
```

### `projects.update`
**Type**: Mutation

```typescript
args: {
  id: v.id("projects"),
  title?: v.string(),
  slug?: v.string(),
  description?: v.string(),
  excerpt?: v.string(),
  imageStorageId?: v.id("_storage"),
  displayOrder?: v.number(),
  isFeatured?: v.boolean(),
}
returns: void
```

### `projects.reorder`
**Type**: Mutation

```typescript
args: {
  orderedIds: v.array(v.id("projects")),
}
returns: void
```

### `projects.delete`
**Type**: Mutation (soft delete)

```typescript
args: {
  id: v.id("projects"),
}
returns: void
// Also soft-deletes achievements? Or cascade on permanent delete?
```

### `projectAchievements.add`
**Type**: Mutation

```typescript
args: {
  projectId: v.id("projects"),
  description: v.string(),
  displayOrder: v.number(),
}
returns: Id<"projectAchievements">
```

### `projectAchievements.update`
**Type**: Mutation

```typescript
args: {
  id: v.id("projectAchievements"),
  description?: v.string(),
  displayOrder?: v.number(),
}
returns: void
```

### `projectAchievements.delete`
**Type**: Mutation (hard delete)

```typescript
args: {
  id: v.id("projectAchievements"),
}
returns: void
```

### `projectAchievements.reorder`
**Type**: Mutation

```typescript
args: {
  projectId: v.id("projects"),
  orderedIds: v.array(v.id("projectAchievements")),
}
returns: void
```

---

## Services

### `services.list`
**Type**: Query (authenticated)

```typescript
args: {
  includeInactive?: boolean,
}
returns: Service[]
```

### `services.listPublic`
**Type**: Query (public)

```typescript
args: {}
returns: Service[] // Only active, ordered
```

### `services.create`
**Type**: Mutation

```typescript
args: {
  title: v.string(),
  description: v.string(),
  iconName: v.string(),
  displayOrder: v.number(),
  isActive: v.boolean(),
}
returns: Id<"services">
```

### `services.update`
**Type**: Mutation

```typescript
args: {
  id: v.id("services"),
  title?: v.string(),
  description?: v.string(),
  iconName?: v.string(),
  displayOrder?: v.number(),
  isActive?: v.boolean(),
}
returns: void
```

### `services.reorder`
**Type**: Mutation

```typescript
args: {
  orderedIds: v.array(v.id("services")),
}
returns: void
```

### `services.delete`
**Type**: Mutation (soft delete)

```typescript
args: {
  id: v.id("services"),
}
returns: void
```

---

## Clients

### `clients.list`
**Type**: Query (authenticated)

```typescript
args: {}
returns: Client[]
```

### `clients.listPublic`
**Type**: Query (public)

```typescript
args: {}
returns: Client[] // Ordered
```

### `clients.create`
**Type**: Mutation

```typescript
args: {
  name: v.string(),
  logoStorageId?: v.id("_storage"),
  websiteUrl?: v.string(),
  displayOrder: v.number(),
}
returns: Id<"clients">
```

### `clients.update`
**Type**: Mutation

```typescript
args: {
  id: v.id("clients"),
  name?: v.string(),
  logoStorageId?: v.id("_storage"),
  websiteUrl?: v.string(),
  displayOrder?: v.number(),
}
returns: void
```

### `clients.reorder`
**Type**: Mutation

```typescript
args: {
  orderedIds: v.array(v.id("clients")),
}
returns: void
```

### `clients.delete`
**Type**: Mutation (soft delete)

```typescript
args: {
  id: v.id("clients"),
}
returns: void
```

---

## Alliances

### `alliances.list`
**Type**: Query (authenticated)

```typescript
args: {}
returns: Alliance[]
```

### `alliances.listPublic`
**Type**: Query (public)

```typescript
args: {}
returns: Alliance[] // Ordered
```

### `alliances.create`
**Type**: Mutation

```typescript
args: {
  name: v.string(),
  logoStorageId?: v.id("_storage"),
  websiteUrl?: v.string(),
  displayOrder: v.number(),
}
returns: Id<"alliances">
```

### `alliances.update`
**Type**: Mutation

```typescript
args: {
  id: v.id("alliances"),
  name?: v.string(),
  logoStorageId?: v.id("_storage"),
  websiteUrl?: v.string(),
  displayOrder?: v.number(),
}
returns: void
```

### `alliances.reorder`
**Type**: Mutation

```typescript
args: {
  orderedIds: v.array(v.id("alliances")),
}
returns: void
```

### `alliances.delete`
**Type**: Mutation (soft delete)

```typescript
args: {
  id: v.id("alliances"),
}
returns: void
```

---

## Newsletter

### `newsletter.list`
**Type**: Query (authenticated)

```typescript
args: {
  search?: v.string(),
  isActive?: v.boolean(),
  limit?: v.number(),
  cursor?: v.string(),
}
returns: {
  subscribers: NewsletterSubscriber[],
  nextCursor?: string,
  total: number,
}
```

### `newsletter.export`
**Type**: Query (authenticated)

```typescript
args: {
  activeOnly?: v.boolean(),
}
returns: string // CSV content
```

### `newsletter.setActive`
**Type**: Mutation

```typescript
args: {
  id: v.id("newsletterSubscribers"),
  isActive: v.boolean(),
}
returns: void
```

### `newsletter.subscribe`
**Type**: Mutation (public)

```typescript
args: {
  email: v.string(),
}
returns: { success: boolean }
// Idempotent - reactivates if inactive
```

---

## Trash (Papelera)

### `trash.list`
**Type**: Query (authenticated)

```typescript
args: {
  type?: "blogPosts" | "teamMembers" | "projects" | "services" | "clients" | "alliances",
}
returns: {
  blogPosts: DeletedItem[],
  teamMembers: DeletedItem[],
  projects: DeletedItem[],
  services: DeletedItem[],
  clients: DeletedItem[],
  alliances: DeletedItem[],
}

type DeletedItem = {
  _id: string,
  type: string,
  title: string, // or name
  deletedAt: number,
  deletedBy: { name: string },
  permanentDeleteAt: number, // 30 days from deletedAt
}
```

### `trash.restore`
**Type**: Mutation

```typescript
args: {
  type: "blogPosts" | "teamMembers" | "projects" | "services" | "clients" | "alliances",
  id: v.string(),
}
returns: void
```

### `trash.permanentDelete`
**Type**: Mutation (super-admin only)

```typescript
args: {
  type: "blogPosts" | "teamMembers" | "projects" | "services" | "clients" | "alliances",
  id: v.string(),
}
returns: void
```

---

## Files

### `files.generateUploadUrl`
**Type**: Mutation (authenticated)

```typescript
args: {}
returns: string // Upload URL
```

### `files.getUrl`
**Type**: Query

```typescript
args: {
  storageId: v.id("_storage"),
}
returns: string | null // Public URL
```

### `files.delete`
**Type**: Mutation (authenticated)

```typescript
args: {
  storageId: v.id("_storage"),
}
returns: void
```

---

## Dashboard Stats

### `stats.getDashboardStats`
**Type**: Query (authenticated)

```typescript
args: {}
returns: {
  blogPosts: {
    total: number,
    published: number,
    drafts: number,
  },
  teamMembers: {
    total: number,
    visible: number,
  },
  projects: {
    total: number,
    featured: number,
  },
  services: {
    total: number,
    active: number,
  },
  clients: number,
  alliances: number,
  subscribers: {
    total: number,
    active: number,
  },
  trash: {
    total: number,
    expiringIn7Days: number,
  },
}
```
