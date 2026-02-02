/**
 * Convex Schema - Zephyra Admin Dashboard
 *
 * Este archivo define el schema completo para el dashboard de administración.
 */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ============================================
  // ADMIN USERS
  // ============================================
  adminUsers: defineTable({
    email: v.string(),
    name: v.string(),
    passwordHash: v.string(),
    role: v.union(v.literal("superadmin"), v.literal("admin")),
    avatarStorageId: v.optional(v.id("_storage")),
    isActive: v.boolean(),
    lastLoginAt: v.optional(v.number()),
    createdAt: v.number(),
    // Soft delete
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("adminUsers")),
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"])
    .index("by_deleted", ["deletedAt"]),

  // ============================================
  // PASSWORD RESET TOKENS
  // ============================================
  passwordResetTokens: defineTable({
    adminUserId: v.id("adminUsers"),
    tokenHash: v.string(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  })
    .index("by_token", ["tokenHash"])
    .index("by_user", ["adminUserId"]),

  // ============================================
  // BLOG POSTS
  // ============================================
  blogPosts: defineTable({
    title: v.string(),
    slug: v.string(),
    excerpt: v.string(),
    content: v.string(), // HTML from WYSIWYG
    coverStorageId: v.optional(v.id("_storage")),
    authorId: v.id("teamMembers"),
    status: v.union(v.literal("draft"), v.literal("published")),
    publishedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    // Soft delete
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("adminUsers")),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"])
    .index("by_status_published", ["status", "publishedAt"])
    .index("by_author", ["authorId"])
    .index("by_deleted", ["deletedAt"]),

  // ============================================
  // TEAM MEMBERS
  // ============================================
  teamMembers: defineTable({
    name: v.string(),
    role: v.string(), // e.g., "Cofundadora", "Consultora"
    specialty: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    displayOrder: v.number(),
    isVisible: v.boolean(),
    // Soft delete
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("adminUsers")),
  })
    .index("by_order", ["displayOrder"])
    .index("by_visible_order", ["isVisible", "displayOrder"])
    .index("by_deleted", ["deletedAt"]),

  // ============================================
  // PROJECTS
  // ============================================
  projects: defineTable({
    title: v.string(),
    slug: v.string(),
    description: v.string(),
    excerpt: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    displayOrder: v.number(),
    isFeatured: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    // Soft delete
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("adminUsers")),
  })
    .index("by_slug", ["slug"])
    .index("by_order", ["displayOrder"])
    .index("by_featured", ["isFeatured", "displayOrder"])
    .index("by_deleted", ["deletedAt"]),

  // ============================================
  // PROJECT ACHIEVEMENTS
  // ============================================
  projectAchievements: defineTable({
    projectId: v.id("projects"),
    description: v.string(),
    displayOrder: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_order", ["projectId", "displayOrder"]),

  // ============================================
  // SERVICES
  // ============================================
  services: defineTable({
    title: v.string(),
    description: v.string(),
    iconName: v.string(), // Material Icon name
    displayOrder: v.number(),
    isActive: v.boolean(),
    // Soft delete
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("adminUsers")),
  })
    .index("by_order", ["displayOrder"])
    .index("by_active_order", ["isActive", "displayOrder"])
    .index("by_deleted", ["deletedAt"]),

  // ============================================
  // CLIENTS
  // ============================================
  clients: defineTable({
    name: v.string(),
    logoStorageId: v.optional(v.id("_storage")),
    websiteUrl: v.optional(v.string()),
    displayOrder: v.number(),
    // Soft delete
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("adminUsers")),
  })
    .index("by_order", ["displayOrder"])
    .index("by_deleted", ["deletedAt"]),

  // ============================================
  // ALLIANCES
  // ============================================
  alliances: defineTable({
    name: v.string(),
    logoStorageId: v.optional(v.id("_storage")),
    websiteUrl: v.optional(v.string()),
    displayOrder: v.number(),
    // Soft delete
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("adminUsers")),
  })
    .index("by_order", ["displayOrder"])
    .index("by_deleted", ["deletedAt"]),

  // ============================================
  // NEWSLETTER SUBSCRIBERS
  // ============================================
  newsletterSubscribers: defineTable({
    email: v.string(),
    subscribedAt: v.number(),
    isActive: v.boolean(),
    unsubscribedAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_active", ["isActive"])
    .index("by_subscribed", ["subscribedAt"]),
});
