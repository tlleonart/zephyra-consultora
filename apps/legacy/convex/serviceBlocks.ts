import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ============================================
// QUERIES
// ============================================

export const list = query({
  args: {},
  handler: async (ctx) => {
    const blocks = await ctx.db
      .query("serviceBlocks")
      .withIndex("by_order")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const blocksWithDetails = await Promise.all(
      blocks.map(async (block) => {
        const services = await ctx.db
          .query("services")
          .withIndex("by_block", (q) => q.eq("blockId", block._id))
          .filter((q) => q.eq(q.field("deletedAt"), undefined))
          .collect();

        const imageUrl = block.imageStorageId
          ? await ctx.storage.getUrl(block.imageStorageId)
          : null;

        return {
          ...block,
          serviceCount: services.length,
          imageUrl,
        };
      })
    );

    return blocksWithDetails;
  },
});

export const getById = query({
  args: { id: v.id("serviceBlocks") },
  handler: async (ctx, args) => {
    const block = await ctx.db.get(args.id);
    if (!block || block.deletedAt) return null;

    const services = await ctx.db
      .query("services")
      .withIndex("by_block_order", (q) => q.eq("blockId", block._id))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const imageUrl = block.imageStorageId
      ? await ctx.storage.getUrl(block.imageStorageId)
      : null;

    return {
      ...block,
      services,
      imageUrl,
    };
  },
});

export const listForSelect = query({
  args: {},
  handler: async (ctx) => {
    const blocks = await ctx.db
      .query("serviceBlocks")
      .withIndex("by_order")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    return blocks.map((block) => ({
      _id: block._id,
      title: block.title,
    }));
  },
});

export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const blocks = await ctx.db
      .query("serviceBlocks")
      .withIndex("by_active_order", (q) => q.eq("isActive", true))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const blocksWithServices = await Promise.all(
      blocks.map(async (block) => {
        const services = await ctx.db
          .query("services")
          .withIndex("by_block_order", (q) => q.eq("blockId", block._id))
          .filter((q) =>
            q.and(
              q.eq(q.field("isActive"), true),
              q.eq(q.field("deletedAt"), undefined)
            )
          )
          .collect();

        const imageUrl = block.imageStorageId
          ? await ctx.storage.getUrl(block.imageStorageId)
          : null;

        return {
          _id: block._id,
          title: block.title,
          subtitle: block.subtitle,
          imageUrl,
          services: services.map((s) => ({
            _id: s._id,
            title: s.title,
            description: s.description,
            iconName: s.iconName,
          })),
        };
      })
    );

    // Exclude empty blocks
    return blocksWithServices.filter((block) => block.services.length > 0);
  },
});

// ============================================
// MUTATIONS
// ============================================

export const create = mutation({
  args: {
    title: v.string(),
    subtitle: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const lastBlock = await ctx.db
      .query("serviceBlocks")
      .withIndex("by_order")
      .order("desc")
      .first();

    const displayOrder = lastBlock ? lastBlock.displayOrder + 1 : 0;

    const id = await ctx.db.insert("serviceBlocks", {
      title: args.title.trim(),
      subtitle: args.subtitle.trim(),
      imageStorageId: args.imageStorageId,
      displayOrder,
      isActive: args.isActive,
    });

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("serviceBlocks"),
    title: v.optional(v.string()),
    subtitle: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const block = await ctx.db.get(args.id);
    if (!block || block.deletedAt) {
      throw new Error("Bloque no encontrado");
    }

    const updates: Record<string, unknown> = {};

    if (args.title !== undefined) updates.title = args.title.trim();
    if (args.subtitle !== undefined) updates.subtitle = args.subtitle.trim();
    if (args.imageStorageId !== undefined)
      updates.imageStorageId = args.imageStorageId;
    if (args.isActive !== undefined) updates.isActive = args.isActive;

    await ctx.db.patch(args.id, updates);
  },
});

export const remove = mutation({
  args: {
    id: v.id("serviceBlocks"),
    adminUserId: v.id("adminUsers"),
  },
  handler: async (ctx, args) => {
    const block = await ctx.db.get(args.id);
    if (!block || block.deletedAt) {
      throw new Error("Bloque no encontrado");
    }

    // Soft-delete the block
    await ctx.db.patch(args.id, {
      deletedAt: Date.now(),
      deletedBy: args.adminUserId,
    });

    // Clear blockId and blockDisplayOrder on all assigned services
    const assignedServices = await ctx.db
      .query("services")
      .withIndex("by_block", (q) => q.eq("blockId", args.id))
      .collect();

    for (const service of assignedServices) {
      await ctx.db.patch(service._id, {
        blockId: undefined,
        blockDisplayOrder: undefined,
      });
    }
  },
});

export const reorder = mutation({
  args: {
    orderedIds: v.array(v.id("serviceBlocks")),
  },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.orderedIds.length; i++) {
      await ctx.db.patch(args.orderedIds[i], { displayOrder: i });
    }
  },
});

export const toggleActive = mutation({
  args: { id: v.id("serviceBlocks") },
  handler: async (ctx, args) => {
    const block = await ctx.db.get(args.id);
    if (!block || block.deletedAt) {
      throw new Error("Bloque no encontrado");
    }

    await ctx.db.patch(args.id, {
      isActive: !block.isActive,
    });
  },
});

// ============================================
// SERVICE ASSIGNMENT MUTATIONS
// ============================================

export const assignService = mutation({
  args: {
    blockId: v.id("serviceBlocks"),
    serviceId: v.id("services"),
  },
  handler: async (ctx, args) => {
    const block = await ctx.db.get(args.blockId);
    if (!block || block.deletedAt) {
      throw new Error("Bloque no encontrado");
    }

    const service = await ctx.db.get(args.serviceId);
    if (!service || service.deletedAt) {
      throw new Error("Servicio no encontrado");
    }

    // Get next blockDisplayOrder
    const existingServices = await ctx.db
      .query("services")
      .withIndex("by_block_order", (q) => q.eq("blockId", args.blockId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const maxOrder = existingServices.reduce(
      (max, s) => Math.max(max, s.blockDisplayOrder ?? 0),
      -1
    );

    await ctx.db.patch(args.serviceId, {
      blockId: args.blockId,
      blockDisplayOrder: maxOrder + 1,
    });
  },
});

export const removeService = mutation({
  args: {
    serviceId: v.id("services"),
  },
  handler: async (ctx, args) => {
    const service = await ctx.db.get(args.serviceId);
    if (!service || service.deletedAt) {
      throw new Error("Servicio no encontrado");
    }

    await ctx.db.patch(args.serviceId, {
      blockId: undefined,
      blockDisplayOrder: undefined,
    });
  },
});

export const reorderServices = mutation({
  args: {
    blockId: v.id("serviceBlocks"),
    orderedServiceIds: v.array(v.id("services")),
  },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.orderedServiceIds.length; i++) {
      await ctx.db.patch(args.orderedServiceIds[i], {
        blockDisplayOrder: i,
      });
    }
  },
});
