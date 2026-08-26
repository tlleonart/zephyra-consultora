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
    const [
      blogPosts,
      teamMembers,
      projects,
      services,
      clients,
      alliances,
      newsletter,
      lmsCourses,
      adminUsers,
      serviceBlocks,
    ] = await Promise.all([
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
      ctx.db
        .query("lmsCourses")
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect(),
      ctx.db
        .query("adminUsers")
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect(),
      ctx.db
        .query("serviceBlocks")
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect(),
    ]);

    // Published vs draft blog posts
    const publishedPosts = blogPosts.filter((p) => p.status === "published");
    const draftPosts = blogPosts.filter((p) => p.status === "draft");

    // Active newsletter subscribers
    const activeSubscribers = newsletter.filter((s) => s.isActive);

    // LMS courses: archived rows are superseded-by-reingest copies (E03 —
    // schema.ts:236), not part of the live catalog. Counting them would
    // overstate what admins actually manage, so the dashboard card mirrors
    // LmsCourseList's default "Publicados" view and excludes status:"archived".
    const activeCourses = lmsCourses.filter((c) => c.status !== "archived");
    const publishedCourses = activeCourses.filter((c) => c.status === "published");
    const draftCourses = activeCourses.filter((c) => c.status === "draft");

    // Get trash count.
    // NOTE (C-05): this intentionally still omits serviceBlocks. The single
    // source of truth for what's restorable from the trash is convex/trash.ts
    // (list/restore/permanentDelete), whose EntityType union — mirrored in
    // apps/backoffice's TrashList — does not include "serviceBlocks" either.
    // Adding serviceBlocks here without also wiring convex/trash.ts + TrashList
    // would make this card's number diverge from what /admin/trash actually
    // shows/restores. Both those files are outside this task's declared
    // surface (stats.ts + DashboardHome.tsx only), so left as-is — flagged for
    // a follow-up task rather than fixed silently.
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
      lms: {
        total: activeCourses.length,
        published: publishedCourses.length,
        drafts: draftCourses.length,
      },
      adminUsers: adminUsers.length,
      serviceBlocks: serviceBlocks.length,
      trash: trashCount,
    };
  },
});
