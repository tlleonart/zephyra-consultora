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
    imagePositionX: v.optional(v.number()),
    imagePositionY: v.optional(v.number()),
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
  // SERVICE BLOCKS
  // ============================================
  serviceBlocks: defineTable({
    title: v.string(),
    subtitle: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    displayOrder: v.number(),
    isActive: v.boolean(),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("adminUsers")),
  })
    .index("by_order", ["displayOrder"])
    .index("by_active_order", ["isActive", "displayOrder"])
    .index("by_deleted", ["deletedAt"]),

  // ============================================
  // SERVICES
  // ============================================
  services: defineTable({
    title: v.string(),
    description: v.string(),
    iconName: v.string(), // Material Icon name
    displayOrder: v.number(),
    isActive: v.boolean(),
    blockId: v.optional(v.id("serviceBlocks")),
    blockDisplayOrder: v.optional(v.number()),
    // Soft delete
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("adminUsers")),
  })
    .index("by_order", ["displayOrder"])
    .index("by_active_order", ["isActive", "displayOrder"])
    .index("by_deleted", ["deletedAt"])
    .index("by_block", ["blockId"])
    .index("by_block_order", ["blockId", "blockDisplayOrder"]),

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

  // ============================================
  // LMS — Sprint 0 subset (PDD v1.3 §6.3)
  // All LMS tables are prefixed `lms*` to namespace them against the
  // institutional tables above. Additive change only — institutional
  // tables are untouched. Full aggregate set lands in Sprint 1.
  // ============================================

  // Course aggregate. One row per ingested SCORM course.
  // CAMPUS does not reversion: an updated course = new campusCourseId = new row.
  lmsCourses: defineTable({
    campusCourseId: v.string(), // unique — provider identifier
    title: v.string(),
    slug: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("published"),
      v.literal("archived")
    ),
    scormStorageId: v.optional(v.id("_storage")), // original zip (optional)
    scoFiles: v.optional(v.any()), // map: relative path -> Id<"_storage">
    manifest: v.optional(v.string()), // parsed imsmanifest.xml (serialized)
    scoStructure: v.optional(v.any()), // organizations + items + resources
    entryPoint: v.optional(v.string()), // launch resource path
    createdAt: v.number(),
    updatedAt: v.number(),
    // Soft delete (repo convention)
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("adminUsers")),
  })
    .index("by_campus_course_id", ["campusCourseId"])
    .index("by_slug", ["slug"])
    .index("by_status", ["status"])
    .index("by_deleted", ["deletedAt"]),

  // Enrollment aggregate. Sprint 0 uses a placeholder row for the spike;
  // the real seat/claim flow lands in Sprint 1.
  lmsEnrollments: defineTable({
    seatId: v.optional(v.string()), // Sprint 1: unique once real seats exist
    learnerId: v.string(), // placeholder in Sprint 0 (no lmsCustomers yet)
    courseId: v.id("lmsCourses"),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("expired")
    ),
    claimRequestId: v.optional(v.string()), // Sprint 1: claim idempotency
    startedAt: v.optional(v.number()),
    firstTouchedAt: v.optional(v.number()), // engagement signal
    expiresAt: v.optional(v.number()),
    // Projected from lmsScormEvents (Phase D)
    progressPercent: v.number(),
    scoreRaw: v.optional(v.number()),
    lessonStatus: v.optional(v.string()),
    suspendData: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_course", ["courseId"])
    .index("by_learner", ["learnerId"])
    .index("by_learner_course_status", ["learnerId", "courseId", "status"])
    .index("by_claim_request", ["claimRequestId"]),

  // SCORM event log — append-only audit trail. Never updated or deleted.
  lmsScormEvents: defineTable({
    enrollmentId: v.id("lmsEnrollments"),
    timestamp: v.number(),
    element: v.string(), // e.g. cmi.core.lesson_status, cmi.core.score.raw
    value: v.string(), // raw value sent by the content
    commitId: v.optional(v.string()), // groups SetValue calls of one Commit
  })
    .index("by_enrollment", ["enrollmentId"])
    .index("by_enrollment_timestamp", ["enrollmentId", "timestamp"])
    .index("by_commit", ["commitId"]),

  // ============================================
  // LMS — Sprint 1 additions (PDD v1.3 §6.3 + §7.5)
  // Learner identity + magic-link tokens. Additive only.
  // ============================================

  // Learner / customer aggregate. Three subtypes — individual buyer,
  // organization admin, organization-managed learner. Magic-link is the
  // primary auth path; passwordHash is optional and only present once a
  // learner opts in to set one.
  lmsCustomers: defineTable({
    email: v.string(), // lowercased
    type: v.union(
      v.literal("individual"),
      v.literal("org_admin"),
      v.literal("org_learner")
    ),
    passwordHash: v.optional(v.string()), // argon2id encoded string; absent until learner opts to set
    organizationId: v.optional(v.string()), // lmsOrganizations lands in Sprint 3 — string placeholder for now
    activatedAt: v.optional(v.number()), // set on first successful magic-link consume
    lastLoginAt: v.optional(v.number()),
    createdAt: v.number(),
    // Soft delete (repo convention).
    // Learners NEVER appear as deletedBy in ANY row (PDD H-2 mitigation):
    // self-initiated Habeas Data deletions are processed by an admin, who
    // is the recorded actor.
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("adminUsers")),
  })
    .index("by_email", ["email"])
    .index("by_type", ["type"])
    .index("by_organization", ["organizationId"])
    .index("by_deleted", ["deletedAt"]),

  // Magic-link tokens. Opaque random tokens stored as HMAC-SHA-256 of the
  // raw token (NOT argon2id — argon2id is the wrong tool for opaque random
  // tokens; it burns CPU for no security gain). Single-use: `usedAt` is
  // stamped on consume. TTL is enforced in the consume mutation, not the
  // schema (30min for activation, 15min for signin/recovery).
  lmsMagicLinkTokens: defineTable({
    email: v.string(), // lowercased — may not yet be an lmsCustomers row (activation creates it on consume)
    tokenHash: v.string(), // HMAC-SHA-256(rawToken, MAGIC_LINK_HMAC_KEY)
    purpose: v.union(
      v.literal("learner_activation"),
      v.literal("learner_signin"),
      v.literal("learner_recovery")
    ),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    createdAt: v.number(),
    createdFromIp: v.optional(v.string()), // forensic, optional
  })
    .index("by_token", ["tokenHash"])
    .index("by_email_purpose", ["email", "purpose"])
    .index("by_expires", ["expiresAt"]),
});
