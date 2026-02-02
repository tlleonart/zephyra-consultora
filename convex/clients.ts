import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ============================================
// QUERIES
// ============================================

export const list = query({
  args: {},
  handler: async (ctx) => {
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_order")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // Get logo URLs
    const clientsWithLogos = await Promise.all(
      clients.map(async (client) => {
        let logoUrl = null;
        if (client.logoStorageId) {
          logoUrl = await ctx.storage.getUrl(client.logoStorageId);
        }
        return { ...client, logoUrl };
      })
    );

    return clientsWithLogos;
  },
});

export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_order")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const clientsWithLogos = await Promise.all(
      clients.map(async (client) => {
        let logoUrl = null;
        if (client.logoStorageId) {
          logoUrl = await ctx.storage.getUrl(client.logoStorageId);
        }
        return { ...client, logoUrl };
      })
    );

    return clientsWithLogos;
  },
});

export const getById = query({
  args: { id: v.id("clients") },
  handler: async (ctx, args) => {
    const client = await ctx.db.get(args.id);
    if (!client || client.deletedAt) return null;

    let logoUrl = null;
    if (client.logoStorageId) {
      logoUrl = await ctx.storage.getUrl(client.logoStorageId);
    }

    return { ...client, logoUrl };
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
    const lastClient = await ctx.db
      .query("clients")
      .withIndex("by_order")
      .order("desc")
      .first();

    const displayOrder = lastClient ? lastClient.displayOrder + 1 : 0;

    const id = await ctx.db.insert("clients", {
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
    id: v.id("clients"),
    name: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
    websiteUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const client = await ctx.db.get(args.id);
    if (!client || client.deletedAt) {
      throw new Error("Cliente no encontrado");
    }

    const updates: Partial<typeof client> = {};

    if (args.name !== undefined) updates.name = args.name.trim();
    if (args.logoStorageId !== undefined) updates.logoStorageId = args.logoStorageId;
    if (args.websiteUrl !== undefined) updates.websiteUrl = args.websiteUrl?.trim() || undefined;

    await ctx.db.patch(args.id, updates);
  },
});

export const reorder = mutation({
  args: {
    orderedIds: v.array(v.id("clients")),
  },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.orderedIds.length; i++) {
      await ctx.db.patch(args.orderedIds[i], { displayOrder: i });
    }
  },
});

export const remove = mutation({
  args: {
    id: v.id("clients"),
    adminUserId: v.id("adminUsers"),
  },
  handler: async (ctx, args) => {
    const client = await ctx.db.get(args.id);
    if (!client || client.deletedAt) {
      throw new Error("Cliente no encontrado");
    }

    // Soft delete
    await ctx.db.patch(args.id, {
      deletedAt: Date.now(),
      deletedBy: args.adminUserId,
    });
  },
});
