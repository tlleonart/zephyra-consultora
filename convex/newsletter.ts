import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ============================================
// QUERIES
// ============================================

export const list = query({
  args: {
    search: v.optional(v.string()),
    filterActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let subscribers = await ctx.db
      .query("newsletterSubscribers")
      .withIndex("by_subscribed")
      .order("desc")
      .collect();

    // Filter by search term
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      subscribers = subscribers.filter((sub) =>
        sub.email.toLowerCase().includes(searchLower)
      );
    }

    // Filter by active status
    if (args.filterActive !== undefined) {
      subscribers = subscribers.filter((sub) => sub.isActive === args.filterActive);
    }

    return subscribers;
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const subscribers = await ctx.db
      .query("newsletterSubscribers")
      .collect();

    const total = subscribers.length;
    const active = subscribers.filter((s) => s.isActive).length;
    const unsubscribed = subscribers.filter((s) => !s.isActive).length;

    // Get recent subscriptions (last 30 days)
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = subscribers.filter((s) => s.subscribedAt > thirtyDaysAgo).length;

    return {
      total,
      active,
      unsubscribed,
      recent,
    };
  },
});

export const exportActiveEmails = query({
  args: {},
  handler: async (ctx) => {
    const subscribers = await ctx.db
      .query("newsletterSubscribers")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    return subscribers.map((sub) => ({
      email: sub.email,
      subscribedAt: sub.subscribedAt,
    }));
  },
});

// ============================================
// MUTATIONS
// ============================================

export const subscribe = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();

    // Check if already subscribed
    const existing = await ctx.db
      .query("newsletterSubscribers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existing) {
      // If exists but unsubscribed, reactivate
      if (!existing.isActive) {
        await ctx.db.patch(existing._id, {
          isActive: true,
          unsubscribedAt: undefined,
        });
        return { reactivated: true };
      }
      return { alreadySubscribed: true };
    }

    // Create new subscription
    await ctx.db.insert("newsletterSubscribers", {
      email,
      subscribedAt: Date.now(),
      isActive: true,
    });

    return { subscribed: true };
  },
});

export const setActive = mutation({
  args: {
    id: v.id("newsletterSubscribers"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const subscriber = await ctx.db.get(args.id);
    if (!subscriber) {
      throw new Error("Suscriptor no encontrado");
    }

    await ctx.db.patch(args.id, {
      isActive: args.isActive,
      unsubscribedAt: args.isActive ? undefined : Date.now(),
    });
  },
});

export const remove = mutation({
  args: {
    id: v.id("newsletterSubscribers"),
  },
  handler: async (ctx, args) => {
    const subscriber = await ctx.db.get(args.id);
    if (!subscriber) {
      throw new Error("Suscriptor no encontrado");
    }

    await ctx.db.delete(args.id);
  },
});
