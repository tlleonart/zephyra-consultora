/**
 * LMS — SCORM event functions (Phase D).
 *
 * recordScormEvent is the bridge sink: every LMSSetValue / LMSCommit /
 * LMSFinish that scorm-again emits in the player is forwarded here. The
 * mutation:
 *   1) appends an immutable row to lmsScormEvents (audit trail), and
 *   2) projects the relevant CMI elements onto the lmsEnrollments aggregate
 *      via a per-SCO state map (scoStates), and
 *   3) re-derives completedScoCount + progressPercent + top-level
 *      lessonStatus from scoStates against course.scoStructure.
 *
 * D02 — multi-SCO aggregation lives INSIDE this mutation. Single Convex
 * transaction means the denormalized counter (completedScoCount) cannot
 * drift relative to scoStates (SDD R3 mitigated structurally per Q5 lock).
 * Aggregation MUST NOT be moved to a separate cron/action.
 *
 * See specs/008-zephyra-lms-foundation/scorm-coverage.md for the full element
 * coverage matrix.
 *
 * AUTH (D01): every function keys on `learnerId: Id<"lmsCustomers">` (post-C
 * learner identity). The server-component caller already validated the
 * session-learner cookie via getLearnerSession() before passing learnerId
 * down. Internal recordScormEvent still cross-checks that the enrollment
 * row's learnerId matches the arg, so a forged learnerId in the mutation
 * call cannot patch someone else's progress.
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

// Per-SCO state shape stored inside lmsEnrollments.scoStates. Loose for the
// Sprint 1 spike; can tighten in Sprint 2.
interface ScoState {
  lessonStatus?: string;
  scoreRaw?: number;
  suspendData?: string;
  completedAt?: number;
}

type ScoStateMap = Record<string, ScoState>;

const TERMINAL_COMPLETE = new Set(["completed", "passed"]);
const TERMINAL_ATLEAST_PASSED = new Set(["completed", "passed"]);

/**
 * Count SCOs whose lesson_status is "completed" or "passed". Single source
 * of truth for the denormalized counter — must match the verify-from-events
 * recomputation invariant test in scormEvents.test.ts.
 */
function countCompleted(scoStates: ScoStateMap): number {
  let n = 0;
  for (const k of Object.keys(scoStates)) {
    const status = scoStates[k]?.lessonStatus;
    if (status && TERMINAL_COMPLETE.has(status)) n += 1;
  }
  return n;
}

/**
 * Pull the ordered list of SCO identifiers from a parsed course's
 * scoStructure. Mirrors the manifest parser: each <item> with an
 * identifierref pointing to a "sco" resource counts as one SCO. WHY use item
 * identifiers (not resource identifiers): items are what the player navigates
 * between, and one resource CAN be referenced by multiple items (rare but
 * legal in IMS CP). The 1:1 player-nav-to-progress mapping requires
 * item-level identity.
 */
function extractScoIds(scoStructure: unknown): string[] {
  if (!scoStructure || typeof scoStructure !== "object") return [];
  const s = scoStructure as {
    organizations?: {
      items?: Array<{ identifier?: string; identifierref?: string | null }>;
    };
    resources?: Array<{ identifier?: string; scormType?: string | null }>;
  };
  const items = s.organizations?.items ?? [];
  const resources = s.resources ?? [];
  const scoResourceIds = new Set(
    resources
      .filter((r) => (r.scormType ?? "sco") === "sco")
      .map((r) => r.identifier)
      .filter((x): x is string => typeof x === "string" && x.length > 0)
  );
  const out: string[] = [];
  for (const it of items) {
    if (!it.identifier || !it.identifierref) continue;
    if (scoResourceIds.has(it.identifierref)) {
      out.push(it.identifier);
    }
  }
  return out;
}

/**
 * recordScormEvent
 *
 * Append the event AND patch the enrollment aggregate. element/value are the
 * raw CMI element name and value as written by the content (e.g.
 * "cmi.core.lesson_status" -> "completed", "cmi.core.score.raw" -> "80").
 *
 * D02: scoId identifies WHICH SCO within the course produced the event. The
 * mutation updates scoStates[scoId] and re-derives the aggregate counters
 * (completedScoCount, progressPercent, lessonStatus) in the SAME transaction
 * — no race, no separate aggregator (SDD R3 mitigation per Q5 lock).
 */
export const recordScormEvent = mutation({
  args: {
    learnerId: v.id("lmsCustomers"),
    enrollmentId: v.id("lmsEnrollments"),
    scoId: v.string(),
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

    // 2) Project onto per-SCO state. Clone to avoid in-place mutation of the
    // doc reference returned by ctx.db.get (Convex semantics — patch is what
    // persists, not field assignment).
    const prevScoStates: ScoStateMap =
      (enrollment.scoStates as ScoStateMap | undefined) ?? {};
    const scoStates: ScoStateMap = { ...prevScoStates };
    const prevScoState: ScoState = scoStates[args.scoId]
      ? { ...scoStates[args.scoId] }
      : {};
    const nextScoState: ScoState = { ...prevScoState };

    switch (args.element) {
      case "cmi.core.lesson_status": {
        nextScoState.lessonStatus = args.value;
        if (TERMINAL_COMPLETE.has(args.value) && !nextScoState.completedAt) {
          nextScoState.completedAt = now;
        }
        break;
      }
      case "cmi.core.score.raw": {
        const n = Number(args.value);
        if (!Number.isNaN(n)) nextScoState.scoreRaw = n;
        break;
      }
      case "cmi.suspend_data": {
        nextScoState.suspendData = args.value;
        break;
      }
      // cmi.core.exit, cmi.core.session_time, cmi.core.score.min/max etc. are
      // recorded in the event log but do not move the per-SCO state in Sprint 1.
      default:
        break;
    }
    scoStates[args.scoId] = nextScoState;

    // 3) Re-derive aggregate from scoStates + course.scoStructure.
    // WHY re-derive every event: completedScoCount is denormalized (Q5 lock).
    // Keeping it correct == recompute from the source-of-truth map on every
    // write inside the same transaction.
    const course = (await ctx.db.get(enrollment.courseId)) as
      | Doc<"lmsCourses">
      | null;
    const scoIds = extractScoIds(course?.scoStructure);
    const totalScos = scoIds.length;

    const completedScoCount = countCompleted(scoStates);

    let aggLessonStatus: string;
    if (totalScos <= 0) {
      // No SCO structure declared — fall back to single-SCO behavior keyed off
      // the lone scoId we just wrote. Preserves Sprint-0 fixtures that pre-date
      // the multi-SCO contract.
      aggLessonStatus = nextScoState.lessonStatus ?? "incomplete";
    } else {
      let allCompleted = true;
      let allAtLeastPassed = true;
      for (const sid of scoIds) {
        const st = scoStates[sid]?.lessonStatus;
        if (st !== "completed") allCompleted = false;
        if (!st || !TERMINAL_ATLEAST_PASSED.has(st)) allAtLeastPassed = false;
      }
      if (allCompleted) aggLessonStatus = "completed";
      else if (allAtLeastPassed) aggLessonStatus = "passed";
      else aggLessonStatus = "incomplete";
    }

    const progressPercent =
      totalScos > 0
        ? Math.floor((completedScoCount / totalScos) * 100)
        : aggLessonStatus === "completed" || aggLessonStatus === "passed"
          ? 100
          : 0;

    // 4) Build the patch. The aggregate suspendData mirrors the latest-touched
    // SCO's suspend_data for legacy single-SCO consumer compat; per-SCO
    // suspend_data is the canonical store (scoStates[scoId].suspendData).
    const patch: Partial<Doc<"lmsEnrollments">> = {
      updatedAt: now,
      scoStates,
      completedScoCount,
      progressPercent: Math.max(0, Math.min(100, progressPercent)),
      lessonStatus: aggLessonStatus,
    };

    if (!enrollment.firstTouchedAt) patch.firstTouchedAt = now;
    if (!enrollment.startedAt) patch.startedAt = now;

    if (args.element === "cmi.core.score.raw") {
      const n = Number(args.value);
      if (!Number.isNaN(n)) patch.scoreRaw = n;
    }
    if (args.element === "cmi.suspend_data") {
      patch.suspendData = args.value;
    }

    // Reflect terminal aggregate onto the enrollment status row. WHY only
    // promote to "completed" (never demote): once a learner finishes a course
    // the enrollment is closed; SCO state can still update (last suspend_data
    // commit on Finish) but the lifecycle status doesn't bounce back.
    if (aggLessonStatus === "completed" || aggLessonStatus === "passed") {
      patch.status = "completed";
    }

    await ctx.db.patch(args.enrollmentId, patch);

    return { ok: true };
  },
});

// Reactive read of the enrollment aggregate for the live progress bar.
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
