/**
 * LMS — Course functions (Sprint 0 stubs).
 *
 * Isolated from the institutional function files. Real ingestion logic
 * (client-side unzip -> per-file upload -> manifest parse -> lmsCourses row)
 * lands in Phase D (the SCORM player spike). These stubs exist so the
 * module structure and namespace are in place from the foundation.
 */

import { query } from "../_generated/server";
import { v } from "convex/values";

// List published courses for the public /cursos catalog.
export const listPublished = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("lmsCourses")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();
  },
});

// Get a course by its public slug.
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const course = await ctx.db
      .query("lmsCourses")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (!course || course.deletedAt) return null;
    return course;
  },
});

// NOTE (Phase D): ingestScormPackage mutation/action goes here —
// reads the uploaded zip contents from _storage, parses imsmanifest.xml,
// and inserts the lmsCourses row with status "draft".
