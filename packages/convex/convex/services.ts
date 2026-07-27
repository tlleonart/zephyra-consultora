import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ============================================
// QUERIES
// ============================================

export const list = query({
  args: {},
  handler: async (ctx) => {
    const services = await ctx.db
      .query("services")
      .withIndex("by_order")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const servicesWithBlock = await Promise.all(
      services.map(async (service) => {
        let blockTitle: string | null = null;
        if (service.blockId) {
          const block = await ctx.db.get(service.blockId);
          if (block && !block.deletedAt) {
            blockTitle = block.title;
          }
        }
        return { ...service, blockTitle };
      })
    );

    return servicesWithBlock;
  },
});

export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const services = await ctx.db
      .query("services")
      .withIndex("by_active_order", (q) => q.eq("isActive", true))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    return services;
  },
});

export const getById = query({
  args: { id: v.id("services") },
  handler: async (ctx, args) => {
    const service = await ctx.db.get(args.id);
    if (!service || service.deletedAt) return null;
    return { ...service, blockId: service.blockId ?? undefined };
  },
});

// ============================================
// MUTATIONS
// ============================================

export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    iconName: v.string(),
    isActive: v.boolean(),
    blockId: v.optional(v.id("serviceBlocks")),
  },
  handler: async (ctx, args) => {
    // Get next display order
    const lastService = await ctx.db
      .query("services")
      .withIndex("by_order")
      .order("desc")
      .first();

    const displayOrder = lastService ? lastService.displayOrder + 1 : 0;

    const id = await ctx.db.insert("services", {
      title: args.title.trim(),
      description: args.description.trim(),
      iconName: args.iconName,
      displayOrder,
      isActive: args.isActive,
      blockId: args.blockId,
    });

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("services"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    iconName: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    blockId: v.optional(v.id("serviceBlocks")),
  },
  handler: async (ctx, args) => {
    const service = await ctx.db.get(args.id);
    if (!service || service.deletedAt) {
      throw new Error("Servicio no encontrado");
    }

    const updates: Record<string, unknown> = {};

    if (args.title !== undefined) updates.title = args.title.trim();
    if (args.description !== undefined) updates.description = args.description.trim();
    if (args.iconName !== undefined) updates.iconName = args.iconName;
    if (args.isActive !== undefined) updates.isActive = args.isActive;
    if (args.blockId !== undefined) updates.blockId = args.blockId;

    await ctx.db.patch(args.id, updates);
  },
});

export const reorder = mutation({
  args: {
    orderedIds: v.array(v.id("services")),
  },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.orderedIds.length; i++) {
      await ctx.db.patch(args.orderedIds[i], { displayOrder: i });
    }
  },
});

export const toggleActive = mutation({
  args: { id: v.id("services") },
  handler: async (ctx, args) => {
    const service = await ctx.db.get(args.id);
    if (!service || service.deletedAt) {
      throw new Error("Servicio no encontrado");
    }

    await ctx.db.patch(args.id, {
      isActive: !service.isActive,
    });
  },
});

export const remove = mutation({
  args: {
    id: v.id("services"),
    adminUserId: v.id("adminUsers"),
  },
  handler: async (ctx, args) => {
    const service = await ctx.db.get(args.id);
    if (!service || service.deletedAt) {
      throw new Error("Servicio no encontrado");
    }

    // Soft delete
    await ctx.db.patch(args.id, {
      deletedAt: Date.now(),
      deletedBy: args.adminUserId,
    });
  },
});
