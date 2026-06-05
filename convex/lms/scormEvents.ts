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
 * AUTH (D01): every function now keys on `learnerId: Id<"lmsCustomers">`
 * (post-C learner identity; was admin masquerade through Sprint 0). The
 * server-component caller already validated the session-learner cookie via
 * getLearnerSession() before passing learnerId down — same trust contract as
 * lms/enrollments.ts. Internal recordScormEvent still cross-checks that the
 * enrollment row's learnerId matches the arg, so a forged learnerId in the
 * mutation call cannot patch someone else's progress.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { Doc } from "../_generated/dataModel";

// Read the append-only event trail for an enrollment, ordered by time.
// Same trust contract as the other learner-keyed reads in this file.
export const listByEnrollment = query({
  args: {
    learnerId: v.id("lmsCustomers"),
    enrollmentId: v.id("lmsEnrollments"),
  },
  handler: async (ctx, args) => {
    // Cross-check ownership: the enrollment's learnerId must match the arg.
    // Defense in depth against a learnerId+enrollmentId mismatch (e.g. UI bug
    // mixing two learners' state in the same tab).
    const enrollment = await ctx.db.get(args.enrollmentId);
    if (!enrollment || enrollment.learnerId !== args.learnerId) {
      return [];
    }

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
 * Real per-unit progress aggregation lands in Sprint 2.
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
 */
export const recordScormEvent = mutation({
  args: {
    learnerId: v.id("lmsCustomers"),
    enrollmentId: v.id("lmsEnrollments"),
    element: v.string(),
    value: v.string(),
    commitId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const enrollment = await ctx.db.get(args.enrollmentId);
    if (!enrollment) {
      throw new Error("recordScormEvent: enrollment not found");
    }
    // Ownership cross-check (see listByEnrollment).
    if (enrollment.learnerId !== args.learnerId) {
      throw new Error("recordScormEvent: enrollment does not belong to learner");
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

// Reactive read of the enrollment aggregate for the live progress bar (AC-D03.5).
// Same trust contract as the other learner-keyed reads in this file.
export const getEnrollment = query({
  args: {
    learnerId: v.id("lmsCustomers"),
    courseId: v.id("lmsCourses"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("lmsEnrollments")
      .withIndex("by_learner_course_status", (q) =>
        q
          .eq("learnerId", args.learnerId)
          .eq("courseId", args.courseId)
          .eq("status", "active")
      )
      .first();
  },
});
