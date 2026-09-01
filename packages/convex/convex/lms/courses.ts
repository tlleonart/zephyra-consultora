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

import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  QueryCtx,
} from "../_generated/server";
import { api, internal } from "../_generated/api";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { AuthError, requireAuth, requireRole } from "../model/auth";
import { parseScormManifest } from "./manifest";

// The five topic slugs — closed taxonomy, frozen by the T-04 schema contract
// (CONTRACT-TOPIC-FIELD-2026-08-26.md §3). Mirrors the v.union literals on
// lmsCourses.topic in schema.ts exactly; not sourced from schema.ts at
// runtime (same house convention as setStatus's status union below, which
// re-spells rather than imports the schema's literal set). Exported so
// apps/backoffice/tests/unit/shared/lmsTopicTaxonomy.test.ts (M-HOME
// amendment) can pin this list, updateCourseMeta's args union below, and
// @zephyra/utils's label map all to schema.ts's actual runtime validator —
// a 6th slug added to schema.ts alone must fail that test loudly instead of
// listPublishedByTopic silently returning [] for it forever.
export const TOPIC_SLUGS = [
  "diversidad-inclusion",
  "liderazgo",
  "sostenibilidad",
  "cultura-organizacional",
  "comunicacion",
] as const;
type TopicSlug = (typeof TOPIC_SLUGS)[number];

function isTopicSlug(value: string): value is TopicSlug {
  return (TOPIC_SLUGS as readonly string[]).includes(value);
}

// Shared by listPublished and listPublishedTopics — see T-04 contract §6:
// "which topics have >=1 published course" is a reduction over this same
// already-indexed result set, not a new indexed access pattern.
async function fetchPublishedCourses(ctx: QueryCtx) {
  return await ctx.db
    .query("lmsCourses")
    .withIndex("by_status", (q) => q.eq("status", "published"))
    .filter((q) => q.eq(q.field("deletedAt"), undefined))
    .collect();
}

// PUBLIC — catalog surface; reads only status:"published"; used by /cursos
export const listPublished = query({
  args: {},
  handler: async (ctx) => {
    return await fetchPublishedCourses(ctx);
  },
});

// PUBLIC — backs /cursos?tema=<slug> and the home's topic chips (T-04).
// `topic` is plain v.string(), not the closed v.literal union: it comes off
// a URL query string, i.e. untrusted/user-controlled input, and Convex would
// throw an ArgumentValidationError on the client-facing catalog page for any
// stale/typo'd/malicious `?tema=` value if we validated it at the arg layer.
// Instead we validate in-handler and treat an unrecognized slug as "no
// courses in this topic" (empty array) rather than an error — it must never
// fall through to an unfiltered query, which would hand back the whole
// catalog under a bogus topic URL. This mirrors AC 4 ("chips don't lie"):
// an unknown topic behaves exactly like a real topic with zero published
// courses, both render nothing.
export const listPublishedByTopic = query({
  args: { topic: v.string() },
  handler: async (ctx, args) => {
    if (!isTopicSlug(args.topic)) {
      return [];
    }
    const topic: TopicSlug = args.topic;
    return await ctx.db
      .query("lmsCourses")
      .withIndex("by_status_topic", (q) =>
        q.eq("status", "published").eq("topic", topic)
      )
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();
  },
});

// PUBLIC — tells the home which topic chips to render (spec §3.2, AC 4: a
// topic with zero published courses must not render a chip at all). Not a
// new index — a reduction over fetchPublishedCourses's already-indexed
// result set (T-04 contract §6 is explicit: do not add by_topic for this).
export const listPublishedTopics = query({
  args: {},
  handler: async (ctx) => {
    const courses = await fetchPublishedCourses(ctx);
    const topics = new Set<TopicSlug>();
    for (const course of courses) {
      if (course.topic) {
        topics.add(course.topic);
      }
    }
    return Array.from(topics);
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

// Admin-only: fetch by slug regardless of status (drafts + archived included).
// E03: backs the edit page so admins can edit drafts/archived rows that
// getBySlug (public) hides.
export const getBySlugAdmin = query({
  args: { userId: v.id("adminUsers"), slug: v.string() },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.userId);
    await requireRole(ctx, args.userId, "admin");

    const course = await ctx.db
      .query("lmsCourses")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (!course || course.deletedAt) return null;
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

// INTERNAL — checkout price/title/slug resolution (Sprint 2 P1.2).
// The createCheckout action calls this to read the authoritative price + the
// fields the MP preference needs. Internal-only: pricing is decided server-side,
// never trusted from the client. Returns null when the course is missing,
// soft-deleted, unpublished, or not purchasable — the action maps that to a
// rejection so an un-priced/draft course can never open a checkout.
export const getCourseForCheckout = internalQuery({
  args: { courseId: v.id("lmsCourses") },
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.courseId);
    if (!course || course.deletedAt) return null;
    if (course.status !== "published") return null;
    if (course.isPurchasable !== true) return null;
    if (typeof course.priceUsd !== "number" || !(course.priceUsd > 0)) {
      return null;
    }
    return {
      _id: course._id,
      title: course.title,
      slug: course.slug,
      priceUsd: course.priceUsd,
    };
  },
});

// Admin-only: set the pricing surface on a course (Sprint 2 P1.4).
// priceUsd must be a positive number whenever isPurchasable is true — a
// purchasable course with no/zero price would open a $0 checkout. When
// isPurchasable is false the price is still stored (so toggling back on
// preserves it) but not validated as positive.
export const updateCoursePricing = mutation({
  args: {
    userId: v.id("adminUsers"),
    id: v.id("lmsCourses"),
    priceUsd: v.number(),
    isPurchasable: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.userId);
    await requireRole(ctx, args.userId, "admin");

    const course = await ctx.db.get(args.id);
    if (!course || course.deletedAt) {
      throw new Error("Curso no encontrado");
    }
    if (args.isPurchasable && !(args.priceUsd > 0)) {
      throw new Error(
        "El precio debe ser mayor a 0 para habilitar la compra del curso"
      );
    }
    if (args.priceUsd < 0) {
      throw new Error("El precio no puede ser negativo");
    }

    await ctx.db.patch(args.id, {
      priceUsd: args.priceUsd,
      currency: "USD",
      isPurchasable: args.isPurchasable,
      updatedAt: Date.now(),
    });
  },
});

/** Cap for a generated slug, in characters. */
const SLUG_MAX = 80;

/**
 * Slugify a title into a URL-safe slug (handles Spanish accents + ñ).
 *
 * WHY THE CUT IS WORD-AWARE. The 80-character cap used to be a bare
 * `.slice(0, 80)`, which lands wherever it lands. Measured on staging
 * 2026-09-01, the one published course carries the slug
 * `...-entornos-laborales-r` — the cap fell inside "respetuosos" and left a
 * dangling `-r`. A course slug is a PERMANENT public URL: it goes into the
 * cutover 301 map, into search results, and into whatever links people have
 * already shared, so a slug is expensive to change once it is live and free
 * to get right before the production ingest. The cut now walks back to the
 * last word boundary, so the tail is a whole word or nothing.
 *
 * This changes no existing slug — those are stored on the row. It only
 * affects courses ingested from here on, which is exactly the set that has
 * not been published yet.
 */
function slugify(input: string): string {
  const base = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (base.length <= SLUG_MAX) return base;

  const cortado = base.slice(0, SLUG_MAX);
  const ultimoCorte = cortado.lastIndexOf("-");
  // If there is no separator to fall back to, the first "word" is already
  // longer than the cap: keep the hard cut rather than returning nothing.
  const recortado = ultimoCorte > 0 ? cortado.slice(0, ultimoCorte) : cortado;
  return recortado.replace(/-+$/g, "");
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
    archivedPriorCount: number;
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
      archivedPriorCount: inserted.archivedPriorCount ?? 0,
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
    // E03 spec-drift FIX (PDD §6.3): CAMPUS does not reversion. A re-ingest of
    // the same campusCourseId must archive any non-archived predecessor row
    // BEFORE inserting the new draft, so existing lmsEnrollments stay pointed
    // at the archived row (no mid-course break) and the public catalog only
    // surfaces the most recent published version.
    const now = Date.now();
    const priorRows = await ctx.db
      .query("lmsCourses")
      .withIndex("by_campus_course_id", (q) =>
        q.eq("campusCourseId", args.campusCourseId)
      )
      .collect();
    let archivedCount = 0;
    for (const prior of priorRows) {
      if (prior.deletedAt) continue;
      if (prior.status === "archived") continue;
      await ctx.db.patch(prior._id, {
        status: "archived",
        archivedAt: now,
        updatedAt: now,
      });
      archivedCount++;
    }

    let slug = slugify(args.title);
    const existingSlug = await ctx.db
      .query("lmsCourses")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existingSlug) {
      slug = `${slug}-${args.campusCourseId.slice(-6)}`;
    }
    // Slug collision can still happen when the same campusCourseId is
    // re-ingested twice in a row (the disambiguated slug from the previous
    // ingest is now also taken). Append the timestamp tail in that case.
    const stillExists = await ctx.db
      .query("lmsCourses")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (stillExists) {
      slug = `${slug}-${now.toString().slice(-6)}`;
    }

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

    return { courseId, slug, archivedPriorCount: archivedCount };
  },
});

/**
 * updateCourseMeta — admin-editable presentation copy.
 *
 * E03 (AC-E03.8): title, description (TipTap HTML), cover image. Slug is NOT
 * regenerated on title change — slugs are URLs and breaking them would orphan
 * existing learner links. SCORM payload fields (manifest, scoFiles,
 * scoStructure, entryPoint, campusCourseId) are intentionally NOT editable
 * here; those only change via re-ingest.
 *
 * T-04/T-05: `topic` joins this form (spec §4.4 — one more CourseMetaForm
 * field, panel-only, never touched by ingest — see the AC 8 guard on
 * ingestScormPackage above). It follows the exact same optional-field
 * semantics `description`/`coverStorageId` already use here: the caller
 * always resends the form's full state, so there's no "field omitted from
 * this call" distinct from "field explicitly cleared" — both patch the
 * column to `undefined`. For `topic` that IS "sin asignar" (T-04 contract
 * §5: absence of the field, never a literal "otros"/"sin-asignar" value), so
 * CourseMetaForm's "sin asignar" option sends no `topic` and this unassigns
 * whatever was set before.
 */
export const updateCourseMeta = mutation({
  args: {
    userId: v.id("adminUsers"),
    id: v.id("lmsCourses"),
    title: v.string(),
    description: v.optional(v.string()),
    coverStorageId: v.optional(v.id("_storage")),
    topic: v.optional(
      v.union(
        v.literal("diversidad-inclusion"),
        v.literal("liderazgo"),
        v.literal("sostenibilidad"),
        v.literal("cultura-organizacional"),
        v.literal("comunicacion")
      )
    ),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.userId);
    await requireRole(ctx, args.userId, "admin");

    const course = await ctx.db.get(args.id);
    if (!course || course.deletedAt) {
      throw new Error("Curso no encontrado");
    }
    const trimmed = args.title.trim();
    if (!trimmed) {
      throw new Error("El título no puede estar vacío");
    }

    await ctx.db.patch(args.id, {
      title: trimmed,
      description: args.description?.trim() || undefined,
      coverStorageId: args.coverStorageId,
      topic: args.topic,
      updatedAt: Date.now(),
    });
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
