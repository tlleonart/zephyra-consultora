/**
 * LMS — SCORM event functions (Phase D).
 *
 * recordScormEvent is the bridge sink: every LMSSetValue / LMSCommit /
 * LMSFinish that scorm-again emits in the player is forwarded here. The
 * mutation:
 *   1) appends an immutable row to lmsScormEvents (audit trail), and
 *   2) projects the relevant CMI elements onto the lmsEnrollments aggregate
 *      (progressPercent, scoreRaw, lessonStatus, suspendData).
 *
 * See specs/008-zephyra-lms-foundation/scorm-coverage.md for the full element
 * coverage matrix.
 *
 * AUTH (B02): every function here gates on adminUsers identity (Sprint-0 spike
 * has admin masquerading as learner; the demo loop accepts that). Row-level
 * ownership ("does THIS learner own THIS enrollment") defers to C01 when the
 * lmsCustomers identity table wires in.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { Doc } from "../_generated/dataModel";
import { requireAuth } from "../model/auth";

// Read the append-only event trail for an enrollment, ordered by time.
// TODO(C01): when lmsCustomers identity wires in, switch to lmsCustomers id +
// add row-level ownership check (does this learner own this enrollment).
export const listByEnrollment = query({
  args: {
    userId: v.id("adminUsers"),
    enrollmentId: v.id("lmsEnrollments"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.userId);

    return await ctx.db
      .query("lmsScormEvents")
      .withIndex("by_enrollment_timestamp", (q) =>
        q.eq("enrollmentId", args.enrollmentId)
      )
      .collect();
  },
});

/**
 * Map a SCORM 1.2 lesson_status to a progress percentage.
 * SCORM 1.2 has no native progress measure (cmi.progress_measure is 2004),
 * so we derive a coarse progress signal from lesson_status for the spike.
 * Real per-unit progress aggregation lands in Sprint 1.
 */
function progressFromStatus(status: string | undefined): number | null {
  switch (status) {
    case "passed":
    case "completed":
      return 100;
    case "failed":
      return 100; // attempted to the end, just not passed
    case "incomplete":
      return 50;
    case "browsed":
      return 25;
    case "not attempted":
      return 0;
    default:
      return null;
  }
}

/**
 * recordScormEvent (AC-D03.1 / AC-D03.2)
 *
 * Append the event AND patch the enrollment aggregate. element/value are the
 * raw CMI element name and value as written by the content (e.g.
 * "cmi.core.lesson_status" -> "completed", "cmi.core.score.raw" -> "80").
 *
 * TODO(C01): when lmsCustomers identity wires in, switch to lmsCustomers id +
 * add row-level ownership check (does this learner own this enrollment).
 */
export const recordScormEvent = mutation({
  args: {
    userId: v.id("adminUsers"),
    enrollmentId: v.id("lmsEnrollments"),
    element: v.string(),
    value: v.string(),
    commitId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.userId);

    const enrollment = await ctx.db.get(args.enrollmentId);
    if (!enrollment) {
      throw new Error("recordScormEvent: enrollment not found");
    }

    const now = Date.now();

    // 1) Append-only audit row. Never updated, never deleted.
    await ctx.db.insert("lmsScormEvents", {
      enrollmentId: args.enrollmentId,
      timestamp: now,
      element: args.element,
      value: args.value,
      commitId: args.commitId,
    });

    // 2) Project onto the aggregate based on which CMI element was written.
    const patch: Partial<Doc<"lmsEnrollments">> = { updatedAt: now };

    // First touch / engagement signal.
    if (!enrollment.firstTouchedAt) {
      patch.firstTouchedAt = now;
    }
    if (!enrollment.startedAt) {
      patch.startedAt = now;
    }

    switch (args.element) {
      case "cmi.core.lesson_status": {
        patch.lessonStatus = args.value;
        const progress = progressFromStatus(args.value);
        if (progress !== null) patch.progressPercent = progress;
        // Reflect terminal states onto the enrollment status too.
        if (args.value === "passed" || args.value === "completed") {
          patch.status = "completed";
        }
        break;
      }
      case "cmi.core.score.raw": {
        const n = Number(args.value);
        if (!Number.isNaN(n)) patch.scoreRaw = n;
        break;
      }
      case "cmi.suspend_data": {
        patch.suspendData = args.value;
        break;
      }
      // cmi.core.exit, cmi.core.session_time, cmi.core.score.min/max etc. are
      // recorded in the event log (step 1) but do not move the aggregate in the
      // Sprint 0 spike. See scorm-coverage.md.
      default:
        break;
    }

    await ctx.db.patch(args.enrollmentId, patch);

    return { ok: true };
  },
});

/**
 * Seed / fetch a placeholder enrollment for the spike (AC-D02.1).
 *
 * Real enrollment (seat claim, learner identity) is Sprint 1. For the spike we
 * need exactly one active enrollment per course so the player has a target for
 * recordScormEvent. Idempotent: returns the existing spike enrollment if present.
 *
 * TODO(C01): when lmsCustomers identity wires in, switch to lmsCustomers id +
 * add row-level ownership check (does this learner own this enrollment).
 */
export const ensureSpikeEnrollment = mutation({
  args: {
    userId: v.id("adminUsers"),
    courseId: v.id("lmsCourses"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.userId);

    const learnerId = "spike-learner";
    const existing = await ctx.db
      .query("lmsEnrollments")
      .withIndex("by_learner_course_status", (q) =>
        q
          .eq("learnerId", learnerId)
          .eq("courseId", args.courseId)
          .eq("status", "active")
      )
      .first();
    if (existing) return existing._id;

    const now = Date.now();
    return await ctx.db.insert("lmsEnrollments", {
      learnerId,
      courseId: args.courseId,
      status: "active",
      progressPercent: 0,
      updatedAt: now,
    });
  },
});

// Reactive read of the enrollment aggregate for the live progress bar (AC-D03.5).
// Looks up by (spike-learner, courseId) so the client doesn't have to round-trip
// to ensureSpikeEnrollment first; mirrors the gated read pattern in the rest of
// the file.
//
// TODO(C01): when lmsCustomers identity wires in, switch to lmsCustomers id +
// add row-level ownership check (does this learner own this enrollment).
export const getEnrollment = query({
  args: {
    userId: v.id("adminUsers"),
    courseId: v.id("lmsCourses"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.userId);

    const learnerId = "spike-learner";
    return await ctx.db
      .query("lmsEnrollments")
      .withIndex("by_learner_course_status", (q) =>
        q
          .eq("learnerId", learnerId)
          .eq("courseId", args.courseId)
          .eq("status", "active")
      )
      .first();
  },
});
