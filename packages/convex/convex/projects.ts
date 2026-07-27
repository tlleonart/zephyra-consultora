import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Helper to generate slug from title
const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100);
};

// ============================================
// QUERIES
// ============================================

export const list = query({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_order")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // Get image URLs and achievements
    const projectsWithDetails = await Promise.all(
      projects.map(async (project) => {
        let imageUrl = null;
        if (project.imageStorageId) {
          imageUrl = await ctx.storage.getUrl(project.imageStorageId);
        }

        const achievements = await ctx.db
          .query("projectAchievements")
          .withIndex("by_project_order", (q) => q.eq("projectId", project._id))
          .collect();

        return {
          ...project,
          imageUrl,
          achievements,
        };
      })
    );

    return projectsWithDetails;
  },
});

export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_order")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const projectsWithDetails = await Promise.all(
      projects.map(async (project) => {
        let imageUrl = null;
        if (project.imageStorageId) {
          imageUrl = await ctx.storage.getUrl(project.imageStorageId);
        }

        const achievements = await ctx.db
          .query("projectAchievements")
          .withIndex("by_project_order", (q) => q.eq("projectId", project._id))
          .collect();

        return {
          ...project,
          imageUrl,
          achievements,
        };
      })
    );

    return projectsWithDetails;
  },
});

export const listFeatured = query({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_featured", (q) => q.eq("isFeatured", true))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const projectsWithDetails = await Promise.all(
      projects.map(async (project) => {
        let imageUrl = null;
        if (project.imageStorageId) {
          imageUrl = await ctx.storage.getUrl(project.imageStorageId);
        }

        const achievements = await ctx.db
          .query("projectAchievements")
          .withIndex("by_project_order", (q) => q.eq("projectId", project._id))
          .collect();

        return {
          ...project,
          imageUrl,
          achievements,
        };
      })
    );

    return projectsWithDetails;
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .first();

    if (!project) return null;

    let imageUrl = null;
    if (project.imageStorageId) {
      imageUrl = await ctx.storage.getUrl(project.imageStorageId);
    }

    const achievements = await ctx.db
      .query("projectAchievements")
      .withIndex("by_project_order", (q) => q.eq("projectId", project._id))
      .collect();

    return {
      ...project,
      imageUrl,
      achievements,
    };
  },
});

export const getById = query({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);
    if (!project || project.deletedAt) return null;

    let imageUrl = null;
    if (project.imageStorageId) {
      imageUrl = await ctx.storage.getUrl(project.imageStorageId);
    }

    const achievements = await ctx.db
      .query("projectAchievements")
      .withIndex("by_project_order", (q) => q.eq("projectId", project._id))
      .collect();

    return {
      ...project,
      imageUrl,
      achievements,
    };
  },
});

// ============================================
// MUTATIONS
// ============================================

export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    excerpt: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    isFeatured: v.boolean(),
    achievements: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const baseSlug = generateSlug(args.title);

    // Check for slug uniqueness
    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const existing = await ctx.db
        .query("projects")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();

      if (!existing) break;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Get next display order
    const lastProject = await ctx.db
      .query("projects")
      .withIndex("by_order")
      .order("desc")
      .first();

    const displayOrder = lastProject ? lastProject.displayOrder + 1 : 0;

    const now = Date.now();
    const projectId = await ctx.db.insert("projects", {
      title: args.title.trim(),
      slug,
      description: args.description.trim(),
      excerpt: args.excerpt.trim(),
      imageStorageId: args.imageStorageId,
      displayOrder,
      isFeatured: args.isFeatured,
      createdAt: now,
      updatedAt: now,
    });

    // Create achievements
    for (let i = 0; i < args.achievements.length; i++) {
      if (args.achievements[i].trim()) {
        await ctx.db.insert("projectAchievements", {
          projectId,
          description: args.achievements[i].trim(),
          displayOrder: i,
        });
      }
    }

    return projectId;
  },
});

export const update = mutation({
  args: {
    id: v.id("projects"),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    excerpt: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    isFeatured: v.optional(v.boolean()),
    achievements: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);
    if (!project || project.deletedAt) {
      throw new Error("Proyecto no encontrado");
    }

    const updates: Partial<typeof project> = {
      updatedAt: Date.now(),
    };

    if (args.title !== undefined) updates.title = args.title.trim();
    if (args.description !== undefined) updates.description = args.description.trim();
    if (args.excerpt !== undefined) updates.excerpt = args.excerpt.trim();
    if (args.imageStorageId !== undefined) updates.imageStorageId = args.imageStorageId;
    if (args.isFeatured !== undefined) updates.isFeatured = args.isFeatured;

    // Handle slug update with uniqueness check
    if (args.slug !== undefined && args.slug !== project.slug) {
      const newSlug = args.slug;
      const existing = await ctx.db
        .query("projects")
        .withIndex("by_slug", (q) => q.eq("slug", newSlug))
        .first();

      if (existing && existing._id !== args.id) {
        throw new Error("Ya existe un proyecto con este slug");
      }
      updates.slug = newSlug;
    }

    await ctx.db.patch(args.id, updates);

    // Update achievements if provided
    if (args.achievements !== undefined) {
      // Delete all existing achievements
      const existingAchievements = await ctx.db
        .query("projectAchievements")
        .withIndex("by_project", (q) => q.eq("projectId", args.id))
        .collect();

      for (const achievement of existingAchievements) {
        await ctx.db.delete(achievement._id);
      }

      // Create new achievements
      for (let i = 0; i < args.achievements.length; i++) {
        if (args.achievements[i].trim()) {
          await ctx.db.insert("projectAchievements", {
            projectId: args.id,
            description: args.achievements[i].trim(),
            displayOrder: i,
          });
        }
      }
    }
  },
});

export const reorder = mutation({
  args: {
    orderedIds: v.array(v.id("projects")),
  },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.orderedIds.length; i++) {
      await ctx.db.patch(args.orderedIds[i], { displayOrder: i });
    }
  },
});

export const toggleFeatured = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);
    if (!project || project.deletedAt) {
      throw new Error("Proyecto no encontrado");
    }

    await ctx.db.patch(args.id, {
      isFeatured: !project.isFeatured,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: {
    id: v.id("projects"),
    adminUserId: v.id("adminUsers"),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);
    if (!project || project.deletedAt) {
      throw new Error("Proyecto no encontrado");
    }

    // Soft delete
    await ctx.db.patch(args.id, {
      deletedAt: Date.now(),
      deletedBy: args.adminUserId,
    });

    // Note: We keep achievements linked to the project for potential restore
  },
});
