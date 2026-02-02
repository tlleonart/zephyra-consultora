import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

type EntityType = 'blogPosts' | 'teamMembers' | 'projects' | 'services' | 'clients' | 'alliances' | 'adminUsers';

interface TrashItem {
  _id: string;
  entityType: EntityType;
  name: string;
  deletedAt: number;
  deletedBy?: string;
  deletedByName?: string;
}

// ============================================
// QUERIES
// ============================================

export const list = query({
  args: {},
  handler: async (ctx): Promise<TrashItem[]> => {
    const trashItems: TrashItem[] = [];

    // Fetch deleted blog posts
    const deletedBlogPosts = await ctx.db
      .query("blogPosts")
      .filter((q) => q.neq(q.field("deletedAt"), undefined))
      .collect();

    for (const post of deletedBlogPosts) {
      let deletedByName: string | undefined;
      if (post.deletedBy) {
        const deleter = await ctx.db.get(post.deletedBy);
        deletedByName = deleter?.name;
      }
      trashItems.push({
        _id: post._id,
        entityType: 'blogPosts',
        name: post.title,
        deletedAt: post.deletedAt!,
        deletedBy: post.deletedBy,
        deletedByName,
      });
    }

    // Fetch deleted team members
    const deletedTeamMembers = await ctx.db
      .query("teamMembers")
      .filter((q) => q.neq(q.field("deletedAt"), undefined))
      .collect();

    for (const member of deletedTeamMembers) {
      let deletedByName: string | undefined;
      if (member.deletedBy) {
        const deleter = await ctx.db.get(member.deletedBy);
        deletedByName = deleter?.name;
      }
      trashItems.push({
        _id: member._id,
        entityType: 'teamMembers',
        name: member.name,
        deletedAt: member.deletedAt!,
        deletedBy: member.deletedBy,
        deletedByName,
      });
    }

    // Fetch deleted projects
    const deletedProjects = await ctx.db
      .query("projects")
      .filter((q) => q.neq(q.field("deletedAt"), undefined))
      .collect();

    for (const project of deletedProjects) {
      let deletedByName: string | undefined;
      if (project.deletedBy) {
        const deleter = await ctx.db.get(project.deletedBy);
        deletedByName = deleter?.name;
      }
      trashItems.push({
        _id: project._id,
        entityType: 'projects',
        name: project.title,
        deletedAt: project.deletedAt!,
        deletedBy: project.deletedBy,
        deletedByName,
      });
    }

    // Fetch deleted services
    const deletedServices = await ctx.db
      .query("services")
      .filter((q) => q.neq(q.field("deletedAt"), undefined))
      .collect();

    for (const service of deletedServices) {
      let deletedByName: string | undefined;
      if (service.deletedBy) {
        const deleter = await ctx.db.get(service.deletedBy);
        deletedByName = deleter?.name;
      }
      trashItems.push({
        _id: service._id,
        entityType: 'services',
        name: service.title,
        deletedAt: service.deletedAt!,
        deletedBy: service.deletedBy,
        deletedByName,
      });
    }

    // Fetch deleted clients
    const deletedClients = await ctx.db
      .query("clients")
      .filter((q) => q.neq(q.field("deletedAt"), undefined))
      .collect();

    for (const client of deletedClients) {
      let deletedByName: string | undefined;
      if (client.deletedBy) {
        const deleter = await ctx.db.get(client.deletedBy);
        deletedByName = deleter?.name;
      }
      trashItems.push({
        _id: client._id,
        entityType: 'clients',
        name: client.name,
        deletedAt: client.deletedAt!,
        deletedBy: client.deletedBy,
        deletedByName,
      });
    }

    // Fetch deleted alliances
    const deletedAlliances = await ctx.db
      .query("alliances")
      .filter((q) => q.neq(q.field("deletedAt"), undefined))
      .collect();

    for (const alliance of deletedAlliances) {
      let deletedByName: string | undefined;
      if (alliance.deletedBy) {
        const deleter = await ctx.db.get(alliance.deletedBy);
        deletedByName = deleter?.name;
      }
      trashItems.push({
        _id: alliance._id,
        entityType: 'alliances',
        name: alliance.name,
        deletedAt: alliance.deletedAt!,
        deletedBy: alliance.deletedBy,
        deletedByName,
      });
    }

    // Fetch deleted admin users
    const deletedAdminUsers = await ctx.db
      .query("adminUsers")
      .filter((q) => q.neq(q.field("deletedAt"), undefined))
      .collect();

    for (const user of deletedAdminUsers) {
      let deletedByName: string | undefined;
      if (user.deletedBy) {
        const deleter = await ctx.db.get(user.deletedBy);
        deletedByName = deleter?.name;
      }
      trashItems.push({
        _id: user._id,
        entityType: 'adminUsers',
        name: `${user.name} (${user.email})`,
        deletedAt: user.deletedAt!,
        deletedBy: user.deletedBy,
        deletedByName,
      });
    }

    // Sort by deletedAt descending (most recent first)
    return trashItems.sort((a, b) => b.deletedAt - a.deletedAt);
  },
});

// ============================================
// MUTATIONS
// ============================================

export const restore = mutation({
  args: {
    entityType: v.union(
      v.literal("blogPosts"),
      v.literal("teamMembers"),
      v.literal("projects"),
      v.literal("services"),
      v.literal("clients"),
      v.literal("alliances"),
      v.literal("adminUsers")
    ),
    entityId: v.string(),
  },
  handler: async (ctx, args) => {
    const id = args.entityId as any;

    switch (args.entityType) {
      case "blogPosts":
        await ctx.db.patch(id, { deletedAt: undefined, deletedBy: undefined });
        break;
      case "teamMembers":
        await ctx.db.patch(id, { deletedAt: undefined, deletedBy: undefined });
        break;
      case "projects":
        await ctx.db.patch(id, { deletedAt: undefined, deletedBy: undefined });
        break;
      case "services":
        await ctx.db.patch(id, { deletedAt: undefined, deletedBy: undefined });
        break;
      case "clients":
        await ctx.db.patch(id, { deletedAt: undefined, deletedBy: undefined });
        break;
      case "alliances":
        await ctx.db.patch(id, { deletedAt: undefined, deletedBy: undefined });
        break;
      case "adminUsers":
        await ctx.db.patch(id, { deletedAt: undefined, deletedBy: undefined });
        break;
    }
  },
});

export const permanentDelete = mutation({
  args: {
    entityType: v.union(
      v.literal("blogPosts"),
      v.literal("teamMembers"),
      v.literal("projects"),
      v.literal("services"),
      v.literal("clients"),
      v.literal("alliances"),
      v.literal("adminUsers")
    ),
    entityId: v.string(),
  },
  handler: async (ctx, args) => {
    const id = args.entityId as any;

    switch (args.entityType) {
      case "blogPosts":
        await ctx.db.delete(id);
        break;
      case "teamMembers":
        await ctx.db.delete(id);
        break;
      case "projects":
        // Also delete related achievements
        const achievements = await ctx.db
          .query("projectAchievements")
          .withIndex("by_project", (q) => q.eq("projectId", id))
          .collect();
        for (const achievement of achievements) {
          await ctx.db.delete(achievement._id);
        }
        await ctx.db.delete(id);
        break;
      case "services":
        await ctx.db.delete(id);
        break;
      case "clients":
        await ctx.db.delete(id);
        break;
      case "alliances":
        await ctx.db.delete(id);
        break;
      case "adminUsers":
        await ctx.db.delete(id);
        break;
    }
  },
});
