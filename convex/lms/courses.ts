/**
 * LMS — Course functions.
 *
 * Isolated from the institutional function files. Phase D (the SCORM player
 * spike) implements the ingestion path here:
 *   client-side unzip -> per-file upload to _storage -> ingestScormPackage
 *   mutation parses imsmanifest.xml and inserts the lmsCourses row.
 *
 * The full seat/claim/enrollment domain lands in Sprint 1.
 */

import { action, internalMutation, mutation, query } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { AuthError, requireAuth, requireRole } from "../model/auth";
import { parseScormManifest } from "./manifest";

// PUBLIC — catalog surface; reads only status:"published"; used by /cursos
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

// Admin-only: includes drafts/archived; requires admin role.
export const listAll = query({
  args: { userId: v.id("adminUsers") },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.userId);
    await requireRole(ctx, args.userId, "admin");

    const rows = await ctx.db.query("lmsCourses").order("desc").collect();
    return rows.filter((r) => !r.deletedAt);
  },
});

// PUBLIC — slugs are URLs; only published courses are exposed; used by
// /cursos/<slug>/player + /api/lms/asset/...
// Filtering on status:"published" prevents the Sprint-0 draft leak where any
// guessable slug returned the full course row regardless of status.
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const course = await ctx.db
      .query("lmsCourses")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (!course || course.deletedAt) return null;
    if (course.status !== "published") return null;
    return course;
  },
});

// Admin-only: returns full row regardless of status.
export const getById = query({
  args: { userId: v.id("adminUsers"), id: v.id("lmsCourses") },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.userId);
    await requireRole(ctx, args.userId, "admin");

    const course = await ctx.db.get(args.id);
    if (!course || course.deletedAt) return null;
    return course;
  },
});

/**
 * Slugify a title into a URL-safe slug (handles Spanish accents + ñ).
 */
function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * ingestScormPackage (Phase D — AC-D01.4 / AC-D01.5)
 *
 * This is a Convex ACTION, not a mutation, by necessity: reading blob CONTENT
 * back from `_storage` (`ctx.storage.get(id).text()`) is only available in
 * queries/actions, not mutations. Doing the parse in an action also pre-empts
 * S0-R8 (large-manifest timeout) — actions have a much longer timeout than
 * mutations, so even a pathological 500-item manifest cannot stall the DB write.
 * The DB insert is delegated to the `insertCourse` internalMutation so the row
 * lands transactionally with slug-uniqueness checked at write time.
 *
 * Receives the already-uploaded per-file (path -> storageId) map produced by
 * the browser (JSZip unzip + parallel uploads to generateUploadUrl()).
 */
export const ingestScormPackage = action({
  args: {
    userId: v.id("adminUsers"),
    campusCourseId: v.string(),
    title: v.optional(v.string()),
    files: v.array(
      v.object({
        path: v.string(),
        storageId: v.id("_storage"),
      })
    ),
  },
  handler: async (ctx, args): Promise<{
    courseId: string;
    slug: string;
    title: string;
    entryPoint: string | null;
    fileCount: number;
    parseMs: number;
  }> => {
    // Admin-only ingest. Actions have no ctx.db, so the gate runs via
    // runQuery against the existing public getCurrentUser query (same logic
    // requireAuth/requireRole would apply if this were a mutation: user must
    // exist, be active, not soft-deleted, and have role admin or superadmin).
    const user = await ctx.runQuery(api.adminUsers.getCurrentUser, {
      userId: args.userId,
    });
    if (!user) {
      throw new AuthError("Authentication required");
    }
    if (user.role !== "admin" && user.role !== "superadmin") {
      throw new AuthError("Admin access required");
    }

    // Build the path -> storageId map. Normalize separators to forward slashes.
    const scoFiles: Record<string, Id<"_storage">> = {};
    for (const f of args.files) {
      scoFiles[f.path.replace(/\\/g, "/")] = f.storageId;
    }

    // Locate the manifest. SCORM 1.2 mandates imsmanifest.xml at the package root.
    const manifestKey = Object.keys(scoFiles).find((p) =>
      p.toLowerCase().endsWith("imsmanifest.xml")
    );
    if (!manifestKey) {
      throw new Error(
        "ingestScormPackage: imsmanifest.xml not found in uploaded files"
      );
    }

    const blob = await ctx.storage.get(scoFiles[manifestKey]);
    if (!blob) {
      throw new Error("ingestScormPackage: could not read imsmanifest.xml blob");
    }
    const manifestXml = await blob.text();

    // Parse. Sample manifest is ~3 KB; trivial cost. Timed for the demo report.
    const started = Date.now();
    const parsed = parseScormManifest(manifestXml);
    const parseMs = Date.now() - started;

    const title = args.title?.trim() || parsed.title || args.campusCourseId;

    // Resolve the launch entry point: the href of the first item's resource,
    // falling back to the first SCO resource, then viewer.html if present.
    const entryPoint =
      parsed.entryPoint ||
      Object.keys(scoFiles).find((p) =>
        p.toLowerCase().endsWith("viewer.html")
      ) ||
      null;

    const inserted = await ctx.runMutation(internal.lms.courses.insertCourse, {
      campusCourseId: args.campusCourseId,
      title,
      scoFiles,
      manifest: manifestXml,
      scoStructure: {
        organizations: parsed.organizations,
        resources: parsed.resources,
      },
      entryPoint: entryPoint ?? undefined,
    });

    return {
      courseId: inserted.courseId,
      slug: inserted.slug,
      title,
      entryPoint,
      fileCount: args.files.length,
      parseMs,
    };
  },
});

/**
 * insertCourse — internal mutation that performs the transactional DB write
 * for ingestScormPackage. Slug uniqueness is resolved here at write time.
 * Internal-only: callable only from the gated ingestScormPackage action above.
 */
export const insertCourse = internalMutation({
  args: {
    campusCourseId: v.string(),
    title: v.string(),
    scoFiles: v.any(),
    manifest: v.string(),
    scoStructure: v.any(),
    entryPoint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let slug = slugify(args.title);
    const existing = await ctx.db
      .query("lmsCourses")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing) {
      slug = `${slug}-${args.campusCourseId.slice(-6)}`;
    }

    const now = Date.now();
    const courseId = await ctx.db.insert("lmsCourses", {
      campusCourseId: args.campusCourseId,
      title: args.title,
      slug,
      status: "draft",
      scoFiles: args.scoFiles,
      manifest: args.manifest,
      scoStructure: args.scoStructure,
      entryPoint: args.entryPoint,
      createdAt: now,
      updatedAt: now,
    });

    return { courseId, slug };
  },
});

/**
 * Publish a course (draft -> published) so it shows in the public catalog.
 * Admin-only: state transitions are privileged.
 */
export const setStatus = mutation({
  args: {
    userId: v.id("adminUsers"),
    id: v.id("lmsCourses"),
    status: v.union(
      v.literal("draft"),
      v.literal("published"),
      v.literal("archived")
    ),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.userId);
    await requireRole(ctx, args.userId, "admin");

    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});
