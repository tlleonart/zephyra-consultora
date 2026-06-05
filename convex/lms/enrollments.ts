/**
 * LMS — Enrollment functions (Sprint 1 D01).
 *
 * Replaces Sprint-0's `ensureSpikeEnrollment` placeholder. Real flow:
 *   - issueEnrollment (admin-gated): admin enters a learner's email, we look
 *     up the lmsCustomers row, and we insert an active enrollment for the
 *     (learner, course) pair. Idempotent on duplicate-active to absorb a
 *     double-click without inserting a second row.
 *   - getMyEnrollment (learner-self): server-side query the player page calls
 *     to gate access. NO upstream requireAuth: the caller is a Next.js server
 *     component that has already validated the `session-learner` cookie via
 *     getLearnerSession() and is passing the resulting learnerId. If a hostile
 *     learner forges another's learnerId at the boundary, the worst exposure
 *     is "does this OTHER learner have an active enrollment for this course"
 *     — no PII (no email, no name; the row only contains progress numbers
 *     plus the same learnerId the attacker already supplied). The
 *     security-equivalent admin pattern is `lms/courses.ts:getBySlug` —
 *     also unauthenticated, also relies on the surface-layer gate.
 *   - listMyEnrollments: same trust contract as getMyEnrollment. Powers a
 *     future `/cursos/mis-cursos` dashboard; shipped now so the surface is
 *     symmetric and a follow-up task doesn't have to re-open this file.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { AuthError, requireAuth, requireRole } from "../model/auth";

// Same normalizer as lms/auth.ts. Inlined (not imported) because the auth
// module is large and we only need the trim+lowercase shape; keeping this
// file self-contained avoids pulling magic-link symbols into the bundle.
const normalizeEmail = (raw: string): string => raw.trim().toLowerCase();

// ============================================================================
// issueEnrollment — admin gives a learner access to a course
// ============================================================================
export const issueEnrollment = mutation({
  args: {
    userId: v.id("adminUsers"),
    courseId: v.id("lmsCourses"),
    learnerEmail: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.userId);
    await requireRole(ctx, args.userId, "admin");

    const course = await ctx.db.get(args.courseId);
    if (!course || course.deletedAt) {
      throw new AuthError("curso no encontrado");
    }

    const email = normalizeEmail(args.learnerEmail);

    const customer = await ctx.db
      .query("lmsCustomers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    // Issuing access requires the learner to already be a known customer.
    // Activation (sign-up + magic link consume) is the only path that creates
    // an lmsCustomers row — admin cannot pre-create on the learner's behalf
    // (PDD §7.5 + the H-2 mitigation: admins are never authors of learner
    // identity-bearing rows).
    if (!customer || customer.deletedAt) {
      throw new AuthError(
        "learner no encontrado — debe activar su cuenta primero"
      );
    }

    // Idempotency: a double-click on "Dar acceso" must not insert a duplicate
    // active enrollment. The index includes status so the same (learner,
    // course) pair can hold an expired row + a fresh active row over time;
    // we only collapse on active.
    const existing = await ctx.db
      .query("lmsEnrollments")
      .withIndex("by_learner_course_status", (q) =>
        q
          .eq("learnerId", customer._id)
          .eq("courseId", args.courseId)
          .eq("status", "active")
      )
      .first();

    if (existing) {
      return {
        enrollmentId: existing._id,
        customer: { _id: customer._id, email: customer.email },
        alreadyEnrolled: true,
      };
    }

    const now = Date.now();
    const enrollmentId = await ctx.db.insert("lmsEnrollments", {
      learnerId: customer._id,
      courseId: args.courseId,
      status: "active",
      progressPercent: 0,
      updatedAt: now,
    });

    return {
      enrollmentId,
      customer: { _id: customer._id, email: customer.email },
      alreadyEnrolled: false,
    };
  },
});

// ============================================================================
// getMyEnrollment — learner reads own enrollment for a course
// ============================================================================
//
// Trust contract: caller (server-side via getLearnerSession()) passes
// learnerId from a validated cookie. No upstream gate; see header comment for
// the threat-model reasoning.
export const getMyEnrollment = query({
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

// ============================================================================
// listMyEnrollments — learner reads own enrollments across courses
// ============================================================================
//
// Same trust contract as getMyEnrollment. Returns active + completed; expired
// is excluded so the learner dashboard doesn't surface stale rows alongside
// live ones.
export const listMyEnrollments = query({
  args: {
    learnerId: v.id("lmsCustomers"),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("lmsEnrollments")
      .withIndex("by_learner", (q) => q.eq("learnerId", args.learnerId))
      .collect();
    return rows.filter((r) => r.status !== "expired");
  },
});
