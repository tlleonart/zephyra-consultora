/**
 * LMS — SCORM event functions (Sprint 0 stubs).
 *
 * Isolated from the institutional function files. The real recordScormEvent
 * mutation (append to lmsScormEvents AND project the lmsEnrollments aggregate)
 * lands in Phase D. This stub establishes the module + namespace.
 */

import { query } from "../_generated/server";
import { v } from "convex/values";

// Read the append-only event trail for an enrollment, ordered by time.
export const listByEnrollment = query({
  args: { enrollmentId: v.id("lmsEnrollments") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("lmsScormEvents")
      .withIndex("by_enrollment_timestamp", (q) =>
        q.eq("enrollmentId", args.enrollmentId)
      )
      .collect();
  },
});

// NOTE (Phase D): recordScormEvent mutation goes here —
// 1) append a row to lmsScormEvents (audit, append-only), and
// 2) patch the lmsEnrollments aggregate fields (progressPercent, scoreRaw,
//    lessonStatus, suspendData) based on the SCORM element written.
