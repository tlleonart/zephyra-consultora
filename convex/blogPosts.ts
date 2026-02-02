import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Helper to generate slug from title
const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100);
};

// ============================================
// QUERIES
// ============================================

export const list = query({
  args: {
    status: v.optional(v.union(v.literal("draft"), v.literal("published"))),
  },
  handler: async (ctx, args) => {
    let posts;

    if (args.status) {
      const status = args.status;
      posts = await ctx.db
        .query("blogPosts")
        .withIndex("by_status", (q) => q.eq("status", status))
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .order("desc")
        .collect();
    } else {
      posts = await ctx.db
        .query("blogPosts")
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .order("desc")
        .collect();
    }

    // Get cover URLs and author info
    const postsWithDetails = await Promise.all(
      posts.map(async (post) => {
        let coverUrl = null;
        if (post.coverStorageId) {
          coverUrl = await ctx.storage.getUrl(post.coverStorageId);
        }

        const author = await ctx.db.get(post.authorId);

        return {
          ...post,
          coverUrl,
          authorName: author?.name || "Autor desconocido",
        };
      })
    );

    return postsWithDetails;
  },
});

export const listPublished = query({
  args: {},
  handler: async (ctx) => {
    const posts = await ctx.db
      .query("blogPosts")
      .withIndex("by_status_published", (q) => q.eq("status", "published"))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .order("desc")
      .collect();

    const postsWithDetails = await Promise.all(
      posts.map(async (post) => {
        let coverUrl = null;
        if (post.coverStorageId) {
          coverUrl = await ctx.storage.getUrl(post.coverStorageId);
        }

        const author = await ctx.db.get(post.authorId);

        return {
          ...post,
          coverUrl,
          authorName: author?.name || "Autor desconocido",
        };
      })
    );

    return postsWithDetails;
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const post = await ctx.db
      .query("blogPosts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .first();

    if (!post) return null;

    let coverUrl = null;
    if (post.coverStorageId) {
      coverUrl = await ctx.storage.getUrl(post.coverStorageId);
    }

    const author = await ctx.db.get(post.authorId);

    return {
      ...post,
      coverUrl,
      authorName: author?.name || "Autor desconocido",
    };
  },
});

export const getById = query({
  args: { id: v.id("blogPosts") },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.id);
    if (!post || post.deletedAt) return null;

    let coverUrl = null;
    if (post.coverStorageId) {
      coverUrl = await ctx.storage.getUrl(post.coverStorageId);
    }

    const author = await ctx.db.get(post.authorId);

    return {
      ...post,
      coverUrl,
      authorName: author?.name || "Autor desconocido",
    };
  },
});

// ============================================
// MUTATIONS
// ============================================

export const create = mutation({
  args: {
    title: v.string(),
    excerpt: v.string(),
    content: v.string(),
    coverStorageId: v.optional(v.id("_storage")),
    authorId: v.id("teamMembers"),
    status: v.union(v.literal("draft"), v.literal("published")),
  },
  handler: async (ctx, args) => {
    const baseSlug = generateSlug(args.title);

    // Check for slug uniqueness
    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const existing = await ctx.db
        .query("blogPosts")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();

      if (!existing) break;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const now = Date.now();
    const id = await ctx.db.insert("blogPosts", {
      title: args.title.trim(),
      slug,
      excerpt: args.excerpt.trim(),
      content: args.content,
      coverStorageId: args.coverStorageId,
      authorId: args.authorId,
      status: args.status,
      publishedAt: args.status === "published" ? now : undefined,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("blogPosts"),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    excerpt: v.optional(v.string()),
    content: v.optional(v.string()),
    coverStorageId: v.optional(v.id("_storage")),
    authorId: v.optional(v.id("teamMembers")),
  },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.id);
    if (!post || post.deletedAt) {
      throw new Error("Artículo no encontrado");
    }

    const updates: Partial<typeof post> = {
      updatedAt: Date.now(),
    };

    if (args.title !== undefined) updates.title = args.title.trim();
    if (args.excerpt !== undefined) updates.excerpt = args.excerpt.trim();
    if (args.content !== undefined) updates.content = args.content;
    if (args.coverStorageId !== undefined) updates.coverStorageId = args.coverStorageId;
    if (args.authorId !== undefined) updates.authorId = args.authorId;

    // Handle slug update with uniqueness check
    if (args.slug !== undefined && args.slug !== post.slug) {
      const newSlug = args.slug;
      const existing = await ctx.db
        .query("blogPosts")
        .withIndex("by_slug", (q) => q.eq("slug", newSlug))
        .first();

      if (existing && existing._id !== args.id) {
        throw new Error("Ya existe un artículo con este slug");
      }
      updates.slug = newSlug;
    }

    await ctx.db.patch(args.id, updates);
  },
});

export const publish = mutation({
  args: { id: v.id("blogPosts") },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.id);
    if (!post || post.deletedAt) {
      throw new Error("Artículo no encontrado");
    }

    await ctx.db.patch(args.id, {
      status: "published",
      publishedAt: post.publishedAt || Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const unpublish = mutation({
  args: { id: v.id("blogPosts") },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.id);
    if (!post || post.deletedAt) {
      throw new Error("Artículo no encontrado");
    }

    await ctx.db.patch(args.id, {
      status: "draft",
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: {
    id: v.id("blogPosts"),
    adminUserId: v.id("adminUsers"),
  },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.id);
    if (!post || post.deletedAt) {
      throw new Error("Artículo no encontrado");
    }

    await ctx.db.patch(args.id, {
      deletedAt: Date.now(),
      deletedBy: args.adminUserId,
    });
  },
});
