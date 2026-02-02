import { internalMutation } from "./_generated/server";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const cleanupOldItems = internalMutation({
  handler: async (ctx) => {
    const cutoffDate = Date.now() - THIRTY_DAYS_MS;
    let deletedCount = 0;

    // Clean up old blog posts
    const oldBlogPosts = await ctx.db
      .query("blogPosts")
      .filter((q) =>
        q.and(
          q.neq(q.field("deletedAt"), undefined),
          q.lt(q.field("deletedAt"), cutoffDate)
        )
      )
      .collect();

    for (const post of oldBlogPosts) {
      await ctx.db.delete(post._id);
      deletedCount++;
    }

    // Clean up old team members
    const oldTeamMembers = await ctx.db
      .query("teamMembers")
      .filter((q) =>
        q.and(
          q.neq(q.field("deletedAt"), undefined),
          q.lt(q.field("deletedAt"), cutoffDate)
        )
      )
      .collect();

    for (const member of oldTeamMembers) {
      await ctx.db.delete(member._id);
      deletedCount++;
    }

    // Clean up old projects (and their achievements)
    const oldProjects = await ctx.db
      .query("projects")
      .filter((q) =>
        q.and(
          q.neq(q.field("deletedAt"), undefined),
          q.lt(q.field("deletedAt"), cutoffDate)
        )
      )
      .collect();

    for (const project of oldProjects) {
      // Delete related achievements first
      const achievements = await ctx.db
        .query("projectAchievements")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect();

      for (const achievement of achievements) {
        await ctx.db.delete(achievement._id);
      }

      await ctx.db.delete(project._id);
      deletedCount++;
    }

    // Clean up old services
    const oldServices = await ctx.db
      .query("services")
      .filter((q) =>
        q.and(
          q.neq(q.field("deletedAt"), undefined),
          q.lt(q.field("deletedAt"), cutoffDate)
        )
      )
      .collect();

    for (const service of oldServices) {
      await ctx.db.delete(service._id);
      deletedCount++;
    }

    // Clean up old clients
    const oldClients = await ctx.db
      .query("clients")
      .filter((q) =>
        q.and(
          q.neq(q.field("deletedAt"), undefined),
          q.lt(q.field("deletedAt"), cutoffDate)
        )
      )
      .collect();

    for (const client of oldClients) {
      await ctx.db.delete(client._id);
      deletedCount++;
    }

    // Clean up old alliances
    const oldAlliances = await ctx.db
      .query("alliances")
      .filter((q) =>
        q.and(
          q.neq(q.field("deletedAt"), undefined),
          q.lt(q.field("deletedAt"), cutoffDate)
        )
      )
      .collect();

    for (const alliance of oldAlliances) {
      await ctx.db.delete(alliance._id);
      deletedCount++;
    }

    // Clean up old admin users
    const oldAdminUsers = await ctx.db
      .query("adminUsers")
      .filter((q) =>
        q.and(
          q.neq(q.field("deletedAt"), undefined),
          q.lt(q.field("deletedAt"), cutoffDate)
        )
      )
      .collect();

    for (const user of oldAdminUsers) {
      await ctx.db.delete(user._id);
      deletedCount++;
    }

    console.log(`Cleaned up ${deletedCount} items from trash older than 30 days`);
    return { deletedCount };
  },
});
