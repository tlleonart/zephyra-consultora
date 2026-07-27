import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ============================================
// QUERIES
// ============================================

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const achievements = await ctx.db
      .query("projectAchievements")
      .withIndex("by_project_order", (q) => q.eq("projectId", args.projectId))
      .collect();

    return achievements;
  },
});

// ============================================
// MUTATIONS
// ============================================

export const add = mutation({
  args: {
    projectId: v.id("projects"),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    // Get next display order
    const lastAchievement = await ctx.db
      .query("projectAchievements")
      .withIndex("by_project_order", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .first();

    const displayOrder = lastAchievement ? lastAchievement.displayOrder + 1 : 0;

    const id = await ctx.db.insert("projectAchievements", {
      projectId: args.projectId,
      description: args.description.trim(),
      displayOrder,
    });

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("projectAchievements"),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const achievement = await ctx.db.get(args.id);
    if (!achievement) {
      throw new Error("Logro no encontrado");
    }

    await ctx.db.patch(args.id, {
      description: args.description.trim(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("projectAchievements") },
  handler: async (ctx, args) => {
    const achievement = await ctx.db.get(args.id);
    if (!achievement) {
      throw new Error("Logro no encontrado");
    }

    await ctx.db.delete(args.id);
  },
});

export const reorder = mutation({
  args: {
    orderedIds: v.array(v.id("projectAchievements")),
  },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.orderedIds.length; i++) {
      await ctx.db.patch(args.orderedIds[i], { displayOrder: i });
    }
  },
});
