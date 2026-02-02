import { query } from "./_generated/server";
import { v } from "convex/values";

export const getDashboardStats = query({
  args: { userId: v.id("adminUsers") },
  handler: async (ctx, args) => {
    // Verify user is authenticated (basic check)
    const user = await ctx.db.get(args.userId);
    if (!user || user.deletedAt || !user.isActive) {
      throw new Error("No autorizado");
    }

    // Get counts for each entity (excluding soft-deleted)
    const [blogPosts, teamMembers, projects, services, clients, alliances, newsletter] =
      await Promise.all([
        ctx.db
          .query("blogPosts")
          .filter((q) => q.eq(q.field("deletedAt"), undefined))
          .collect(),
        ctx.db
          .query("teamMembers")
          .filter((q) => q.eq(q.field("deletedAt"), undefined))
          .collect(),
        ctx.db
          .query("projects")
          .filter((q) => q.eq(q.field("deletedAt"), undefined))
          .collect(),
        ctx.db
          .query("services")
          .filter((q) => q.eq(q.field("deletedAt"), undefined))
          .collect(),
        ctx.db
          .query("clients")
          .filter((q) => q.eq(q.field("deletedAt"), undefined))
          .collect(),
        ctx.db
          .query("alliances")
          .filter((q) => q.eq(q.field("deletedAt"), undefined))
          .collect(),
        ctx.db.query("newsletterSubscribers").collect(),
      ]);

    // Published vs draft blog posts
    const publishedPosts = blogPosts.filter((p) => p.status === "published");
    const draftPosts = blogPosts.filter((p) => p.status === "draft");

    // Active newsletter subscribers
    const activeSubscribers = newsletter.filter((s) => s.isActive);

    // Get trash count
    const trashedItems = await Promise.all([
      ctx.db
        .query("blogPosts")
        .filter((q) => q.neq(q.field("deletedAt"), undefined))
        .collect(),
      ctx.db
        .query("teamMembers")
        .filter((q) => q.neq(q.field("deletedAt"), undefined))
        .collect(),
      ctx.db
        .query("projects")
        .filter((q) => q.neq(q.field("deletedAt"), undefined))
        .collect(),
      ctx.db
        .query("services")
        .filter((q) => q.neq(q.field("deletedAt"), undefined))
        .collect(),
      ctx.db
        .query("clients")
        .filter((q) => q.neq(q.field("deletedAt"), undefined))
        .collect(),
      ctx.db
        .query("alliances")
        .filter((q) => q.neq(q.field("deletedAt"), undefined))
        .collect(),
    ]);

    const trashCount = trashedItems.reduce((acc, items) => acc + items.length, 0);

    return {
      blog: {
        total: blogPosts.length,
        published: publishedPosts.length,
        drafts: draftPosts.length,
      },
      team: teamMembers.length,
      projects: projects.length,
      services: services.length,
      clients: clients.length,
      alliances: alliances.length,
      newsletter: {
        total: newsletter.length,
        active: activeSubscribers.length,
      },
      trash: trashCount,
    };
  },
});
