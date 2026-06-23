/**
 * LMS — Progress-consent domain (Sprint 3b Phase D2 — learner opt-in).
 *
 * The learner-side of the privacy gate. By DEFAULT a learner is OPT-OUT: no
 * lmsProgressConsents row ⇒ no consent ⇒ the org owner's nominal-progress read
 * is denied (enforced in lms/seats.ts:getNominalProgress). These mutations let a
 * learner grant / revoke that consent for their (org[, course]) pair.
 *
 * Consent scoping (frozen schema):
 *   - courseId undefined ⇒ ORG-WIDE consent (all the learner's courses in the org).
 *   - courseId present   ⇒ scoped to ONE course.
 * Upsert semantics: one row per (learner, org, courseId) tuple. Re-granting an
 * existing row flips granted:true + stamps grantedAt; revoking flips
 * granted:false + stamps revokedAt. We never delete the row (the revoke is an
 * audit-bearing state change, mirroring the seat release ≠ soft-delete choice).
 *
 * Trust boundary: learner-authenticated. The Next.js server-action layer
 * validates the session-learner cookie via getLearnerSession() and passes the
 * resulting learnerCustomerId; Convex cannot read cookies, so this is a trusted
 * boundary input — the SAME pattern as setLearnerPassword({ learnerId }). The
 * learner can only ever act on THEIR OWN consent (the mutation writes a row
 * keyed on the passed learnerCustomerId; a forged id can only toggle that other
 * learner's consent, which exposes no data here — the nominal READ is separately
 * org-owner-gated). We additionally assert the learner row exists + is not
 * soft-deleted.
 *
 * Runtime: V8 isolate. NEVER add "use node".
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { AuthError } from "../model/auth";

// ============================================================================
// Helper — find the consent row for an exact (learner, org, courseId) tuple
// ============================================================================
//
// by_learner_org narrows to the (learner, org) pair; we then match the exact
// courseId scope (undefined = org-wide) in memory. The set is tiny (a learner
// has at most a handful of consent rows per org).
async function findConsentRow(
  ctx: { db: { query: (t: "lmsProgressConsents") => unknown } },
  learnerCustomerId: Id<"lmsCustomers">,
  organizationId: Id<"lmsOrganizations">,
  courseId: Id<"lmsCourses"> | undefined
) {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const rows = (await (ctx.db.query("lmsProgressConsents") as any)
    .withIndex("by_learner_org", (q: any) =>
      q
        .eq("learnerCustomerId", learnerCustomerId)
        .eq("organizationId", organizationId)
    )
    .collect()) as Array<{
    _id: Id<"lmsProgressConsents">;
    courseId?: Id<"lmsCourses">;
    granted: boolean;
  }>;
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return rows.find((r) => r.courseId === courseId) ?? null;
}

// ============================================================================
// grantProgressConsent — learner opts IN to nominal progress sharing
// ============================================================================
export const grantProgressConsent = mutation({
  args: {
    learnerCustomerId: v.id("lmsCustomers"),
    organizationId: v.id("lmsOrganizations"),
    courseId: v.optional(v.id("lmsCourses")),
  },
  handler: async (ctx, args) => {
    const learner = await ctx.db.get(args.learnerCustomerId);
    if (!learner || learner.deletedAt) {
      throw new AuthError("learner no encontrado");
    }

    const now = Date.now();
    const existing = await findConsentRow(
      ctx,
      args.learnerCustomerId,
      args.organizationId,
      args.courseId
    );
    if (existing) {
      await ctx.db.patch(existing._id, {
        granted: true,
        grantedAt: now,
        revokedAt: undefined,
      });
      return { consentId: existing._id, granted: true as const };
    }

    const consentId = await ctx.db.insert("lmsProgressConsents", {
      learnerCustomerId: args.learnerCustomerId,
      organizationId: args.organizationId,
      courseId: args.courseId,
      granted: true,
      grantedAt: now,
    });
    return { consentId, granted: true as const };
  },
});

// ============================================================================
// revokeProgressConsent — learner opts OUT (audit-bearing state change)
// ============================================================================
export const revokeProgressConsent = mutation({
  args: {
    learnerCustomerId: v.id("lmsCustomers"),
    organizationId: v.id("lmsOrganizations"),
    courseId: v.optional(v.id("lmsCourses")),
  },
  handler: async (ctx, args) => {
    const learner = await ctx.db.get(args.learnerCustomerId);
    if (!learner || learner.deletedAt) {
      throw new AuthError("learner no encontrado");
    }

    const now = Date.now();
    const existing = await findConsentRow(
      ctx,
      args.learnerCustomerId,
      args.organizationId,
      args.courseId
    );
    if (existing) {
      await ctx.db.patch(existing._id, {
        granted: false,
        revokedAt: now,
      });
      return { consentId: existing._id, granted: false as const };
    }

    // No row yet ⇒ already opt-out by default. Record an explicit revoked row
    // so the learner's intent is auditable (and a later grant flips it).
    const consentId = await ctx.db.insert("lmsProgressConsents", {
      learnerCustomerId: args.learnerCustomerId,
      organizationId: args.organizationId,
      courseId: args.courseId,
      granted: false,
      revokedAt: now,
    });
    return { consentId, granted: false as const };
  },
});

// ============================================================================
// getMyConsentState — learner reads their own consent rows for an org
// ============================================================================
//
// Self-scoped: returns the consent rows the learner has for the org so the
// learner UI can render the current opt-in/out state. Default (no rows) ⇒
// opt-out everywhere.
export const getMyConsentState = query({
  args: {
    learnerCustomerId: v.id("lmsCustomers"),
    organizationId: v.id("lmsOrganizations"),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("lmsProgressConsents")
      .withIndex("by_learner_org", (q) =>
        q
          .eq("learnerCustomerId", args.learnerCustomerId)
          .eq("organizationId", args.organizationId)
      )
      .collect();
    return {
      consents: rows.map((r) => ({
        courseId: r.courseId, // undefined ⇒ org-wide
        granted: r.granted,
        grantedAt: r.grantedAt,
        revokedAt: r.revokedAt,
      })),
    };
  },
});
