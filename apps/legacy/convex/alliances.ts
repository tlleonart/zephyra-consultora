import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ============================================
// QUERIES
// ============================================

export const list = query({
  args: {},
  handler: async (ctx) => {
    const alliances = await ctx.db
      .query("alliances")
      .withIndex("by_order")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // Get logo URLs
    const alliancesWithLogos = await Promise.all(
      alliances.map(async (alliance) => {
        let logoUrl = null;
        if (alliance.logoStorageId) {
          logoUrl = await ctx.storage.getUrl(alliance.logoStorageId);
        }
        return { ...alliance, logoUrl };
      })
    );

    return alliancesWithLogos;
  },
});

export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const alliances = await ctx.db
      .query("alliances")
      .withIndex("by_order")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const alliancesWithLogos = await Promise.all(
      alliances.map(async (alliance) => {
        let logoUrl = null;
        if (alliance.logoStorageId) {
          logoUrl = await ctx.storage.getUrl(alliance.logoStorageId);
        }
        return { ...alliance, logoUrl };
      })
    );

    return alliancesWithLogos;
  },
});

export const getById = query({
  args: { id: v.id("alliances") },
  handler: async (ctx, args) => {
    const alliance = await ctx.db.get(args.id);
    if (!alliance || alliance.deletedAt) return null;

    let logoUrl = null;
    if (alliance.logoStorageId) {
      logoUrl = await ctx.storage.getUrl(alliance.logoStorageId);
    }

    return { ...alliance, logoUrl };
  },
});

// ============================================
// MUTATIONS
// ============================================

export const create = mutation({
  args: {
    name: v.string(),
    logoStorageId: v.optional(v.id("_storage")),
    websiteUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get next display order
    const lastAlliance = await ctx.db
      .query("alliances")
      .withIndex("by_order")
      .order("desc")
      .first();

    const displayOrder = lastAlliance ? lastAlliance.displayOrder + 1 : 0;

    const id = await ctx.db.insert("alliances", {
      name: args.name.trim(),
      logoStorageId: args.logoStorageId,
      websiteUrl: args.websiteUrl?.trim() || undefined,
      displayOrder,
    });

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("alliances"),
    name: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
    websiteUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const alliance = await ctx.db.get(args.id);
    if (!alliance || alliance.deletedAt) {
      throw new Error("Alianza no encontrada");
    }

    const updates: Partial<typeof alliance> = {};

    if (args.name !== undefined) updates.name = args.name.trim();
    if (args.logoStorageId !== undefined) updates.logoStorageId = args.logoStorageId;
    if (args.websiteUrl !== undefined) updates.websiteUrl = args.websiteUrl?.trim() || undefined;

    await ctx.db.patch(args.id, updates);
  },
});

export const reorder = mutation({
  args: {
    orderedIds: v.array(v.id("alliances")),
  },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.orderedIds.length; i++) {
      await ctx.db.patch(args.orderedIds[i], { displayOrder: i });
    }
  },
});

export const remove = mutation({
  args: {
    id: v.id("alliances"),
    adminUserId: v.id("adminUsers"),
  },
  handler: async (ctx, args) => {
    const alliance = await ctx.db.get(args.id);
    if (!alliance || alliance.deletedAt) {
      throw new Error("Alianza no encontrada");
    }

    // Soft delete
    await ctx.db.patch(args.id, {
      deletedAt: Date.now(),
      deletedBy: args.adminUserId,
    });
  },
});
