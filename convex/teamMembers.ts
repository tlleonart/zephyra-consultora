import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// ============================================
// QUERIES
// ============================================

export const list = query({
  args: {},
  handler: async (ctx) => {
    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_order")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // Get image URLs
    const membersWithImages = await Promise.all(
      members.map(async (member) => {
        let imageUrl = null;
        if (member.imageStorageId) {
          imageUrl = await ctx.storage.getUrl(member.imageStorageId);
        }
        return { ...member, imageUrl };
      })
    );

    return membersWithImages;
  },
});

export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_visible_order", (q) => q.eq("isVisible", true))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const membersWithImages = await Promise.all(
      members.map(async (member) => {
        let imageUrl = null;
        if (member.imageStorageId) {
          imageUrl = await ctx.storage.getUrl(member.imageStorageId);
        }
        return { ...member, imageUrl };
      })
    );

    return membersWithImages;
  },
});

export const getById = query({
  args: { id: v.id("teamMembers") },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.id);
    if (!member || member.deletedAt) return null;

    let imageUrl = null;
    if (member.imageStorageId) {
      imageUrl = await ctx.storage.getUrl(member.imageStorageId);
    }

    return { ...member, imageUrl };
  },
});

export const canDelete = query({
  args: { id: v.id("teamMembers") },
  handler: async (ctx, args) => {
    // Check if member has any blog posts
    const blogPosts = await ctx.db
      .query("blogPosts")
      .withIndex("by_author", (q) => q.eq("authorId", args.id))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    return {
      canDelete: blogPosts.length === 0,
      blogPostCount: blogPosts.length,
    };
  },
});

// For dropdown in blog form
export const listForSelect = query({
  args: {},
  handler: async (ctx) => {
    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_order")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    return members.map((m) => ({
      _id: m._id,
      name: m.name,
      role: m.role,
    }));
  },
});

// ============================================
// MUTATIONS
// ============================================

export const create = mutation({
  args: {
    name: v.string(),
    role: v.string(),
    specialty: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    isVisible: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Get next display order
    const lastMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_order")
      .order("desc")
      .first();

    const displayOrder = lastMember ? lastMember.displayOrder + 1 : 0;

    const id = await ctx.db.insert("teamMembers", {
      name: args.name.trim(),
      role: args.role.trim(),
      specialty: args.specialty.trim(),
      imageStorageId: args.imageStorageId,
      displayOrder,
      isVisible: args.isVisible,
    });

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("teamMembers"),
    name: v.optional(v.string()),
    role: v.optional(v.string()),
    specialty: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    isVisible: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.id);
    if (!member || member.deletedAt) {
      throw new Error("Miembro no encontrado");
    }

    const updates: Partial<typeof member> = {};

    if (args.name !== undefined) updates.name = args.name.trim();
    if (args.role !== undefined) updates.role = args.role.trim();
    if (args.specialty !== undefined) updates.specialty = args.specialty.trim();
    if (args.imageStorageId !== undefined) updates.imageStorageId = args.imageStorageId;
    if (args.isVisible !== undefined) updates.isVisible = args.isVisible;

    await ctx.db.patch(args.id, updates);
  },
});

export const reorder = mutation({
  args: {
    orderedIds: v.array(v.id("teamMembers")),
  },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.orderedIds.length; i++) {
      await ctx.db.patch(args.orderedIds[i], { displayOrder: i });
    }
  },
});

export const remove = mutation({
  args: {
    id: v.id("teamMembers"),
    adminUserId: v.id("adminUsers"),
  },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.id);
    if (!member || member.deletedAt) {
      throw new Error("Miembro no encontrado");
    }

    // Check if member has blog posts
    const blogPosts = await ctx.db
      .query("blogPosts")
      .withIndex("by_author", (q) => q.eq("authorId", args.id))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    if (blogPosts.length > 0) {
      throw new Error(
        `No se puede eliminar. Este miembro es autor de ${blogPosts.length} artículo(s) de blog.`
      );
    }

    // Soft delete
    await ctx.db.patch(args.id, {
      deletedAt: Date.now(),
      deletedBy: args.adminUserId,
    });
  },
});
