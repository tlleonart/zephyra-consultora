/**
 * LMS — Organization backend (Sprint 3a Phase B0 — Org Admin domain).
 *
 * The B2B buyer aggregate. An organization is created by self-service sign-up:
 *   email + org name → the email is verified via the EXISTING learner magic-link
 *   discipline (lms/auth.ts consumeMagicLink, purpose "learner_activation"),
 *   which mints/activates an lmsCustomers row; THEN createOrganization promotes
 *   that verified customer to the single, persistent Owner Admin (type
 *   "org_admin") and creates the lmsOrganizations row that points back at it.
 *
 * Owner-Admin model (commercial §9.1 / §12.5 LOCKED):
 *   - A single, persistent `ownerCustomerId` per org (NOT an admin array).
 *   - The Owner Admin does NOT consume a seat — they are the buyer/manager, not
 *     a learner. Seats are minted by the money path (mintSeatPackForOrder) and
 *     claimed to org_learners, never to the owner.
 *
 * Authorization — `requireOrgOwner`:
 *   The net-new cross-org isolation control (Risk R3). EVERY pack / checkout /
 *   seat / roster function asserts, via this helper, that the authenticated
 *   caller is the `ownerCustomerId` of the target org. This is distinct from
 *   model/auth.ts requireRole(..., "admin"), which gates Zephyra STAFF
 *   (adminUsers); an org owner is an lmsCustomers row, never an adminUser.
 *
 * Trust boundary (mirrors lms/enrollments.ts:getMyEnrollment and
 * lms/auth.ts:setLearnerPassword): the caller is the Next.js server-action layer
 * which has already validated the `session-learner` cookie via getLearnerSession()
 * and passes the resulting `callerCustomerId`. Convex mutations cannot read
 * cookies, so `callerCustomerId` is a trusted boundary input. requireOrgOwner
 * then verifies that this trusted identity actually owns the target org — so a
 * forged customerId can only ever act on an org the attacker already owns.
 */

import { internalQuery, mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { AuthError } from "../model/auth";

// ============================================================================
// requireOrgOwner — net-new cross-org isolation control (Risk R3)
// ============================================================================
//
// Asserts the authenticated caller is the single Owner Admin of `organizationId`.
// Throws AuthError on every failure mode (caller missing / soft-deleted, org
// missing / soft-deleted, caller is not the owner). Returns the org row on
// success so callers don't re-fetch it. Use on EVERY org-scoped function.
export async function requireOrgOwner(
  ctx: QueryCtx | MutationCtx,
  callerCustomerId: Id<"lmsCustomers">,
  organizationId: Id<"lmsOrganizations">
) {
  const caller = await ctx.db.get(callerCustomerId);
  if (!caller || caller.deletedAt) {
    throw new AuthError("no autorizado");
  }

  const org = await ctx.db.get(organizationId);
  if (!org || org.deletedAt) {
    throw new AuthError("organización no encontrada");
  }

  // The load-bearing check: this caller must BE the org's owner. A different
  // org's owner (or any other customer) is rejected — cross-org isolation.
  if (org.ownerCustomerId !== callerCustomerId) {
    throw new AuthError("no autorizado");
  }

  return org;
}

// ============================================================================
// createOrganization — promote a verified customer to Owner Admin + create org
// ============================================================================
//
// Called by the Next.js server action AFTER the sign-up email was verified via
// the existing magic-link consume (lms/auth.ts, purpose "learner_activation"),
// which created/activated the lmsCustomers row and returned its identity. That
// `ownerCustomerId` is therefore a trusted boundary input (the magic-link
// consume IS the proof of email control), mirroring setLearnerPassword.
//
// Idempotency: an Owner Admin owns at most one org in V1 (single-org owner). A
// re-submitted sign-up for an already-owning customer returns the existing org
// rather than creating a second one (collapse on by_owner). This absorbs a
// double-submit without minting a duplicate organization.
//
// The owner is promoted to type "org_admin" and stamped with organizationId.
// They do NOT consume a seat (§12.5) — seats are a separate aggregate minted by
// the money path and claimed to org_learners.
export const createOrganization = mutation({
  args: {
    ownerCustomerId: v.id("lmsCustomers"),
    name: v.string(),
    taxId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const owner = await ctx.db.get(args.ownerCustomerId);
    if (!owner || owner.deletedAt) {
      throw new AuthError("cuenta no encontrada — verificá tu email primero");
    }
    // The owner must have a verified (activated) email — sign-up gates org
    // creation behind the same email-control proof as a B2C learner.
    if (owner.activatedAt === undefined) {
      throw new AuthError("verificá tu email antes de crear la organización");
    }

    const name = args.name.trim();
    if (name.length === 0) {
      throw new AuthError("el nombre de la organización es obligatorio");
    }

    // Idempotency: collapse on an existing org owned by this customer.
    const existing = await ctx.db
      .query("lmsOrganizations")
      .withIndex("by_owner", (q) => q.eq("ownerCustomerId", args.ownerCustomerId))
      .first();
    if (existing && !existing.deletedAt) {
      return {
        organizationId: existing._id,
        ownerCustomerId: existing.ownerCustomerId,
        alreadyExisted: true,
      };
    }

    const now = Date.now();
    const organizationId = await ctx.db.insert("lmsOrganizations", {
      name,
      taxId: args.taxId?.trim() || undefined,
      ownerCustomerId: args.ownerCustomerId,
      createdAt: now,
    });

    // Promote the verified customer to the persistent Owner Admin and bind them
    // to the org. The owner is type "org_admin" and never an org_learner — they
    // do not consume a seat.
    await ctx.db.patch(args.ownerCustomerId, {
      type: "org_admin",
      organizationId,
    });

    return {
      organizationId,
      ownerCustomerId: args.ownerCustomerId,
      alreadyExisted: false,
    };
  },
});

// ============================================================================
// assertOrgOwner — internal gate for the action layer (pack checkout)
// ============================================================================
//
// internalQuery wrapper around requireOrgOwner. Convex actions have no ctx.db,
// so the pack checkout ACTION cannot call requireOrgOwner directly — it calls
// this first and only proceeds on a truthy result. Throws (AuthError) on any
// non-owner caller, so the action fails closed before opening a checkout.
// Returns the owner's email (for the MP payer prefill) so the action doesn't
// need a second round-trip.
export const assertOrgOwner = internalQuery({
  args: {
    callerCustomerId: v.id("lmsCustomers"),
    organizationId: v.id("lmsOrganizations"),
  },
  handler: async (ctx, args) => {
    await requireOrgOwner(ctx, args.callerCustomerId, args.organizationId);
    const owner = await ctx.db.get(args.callerCustomerId);
    if (!owner || owner.deletedAt) {
      throw new AuthError("no autorizado");
    }
    return { ownerEmail: owner.email };
  },
});

// ============================================================================
// getMyOrganization — Owner Admin reads the org they own
// ============================================================================
//
// PUBLIC query gated by requireOrgOwner. The Next.js layer passes the
// cookie-derived callerCustomerId + the target organizationId; the helper
// rejects any caller who is not the owner of that org (cross-org isolation).
// Returns the org fields the Org-Admin console needs (no internal audit fields).
export const getMyOrganization = query({
  args: {
    callerCustomerId: v.id("lmsCustomers"),
    organizationId: v.id("lmsOrganizations"),
  },
  handler: async (ctx, args) => {
    const org = await requireOrgOwner(
      ctx,
      args.callerCustomerId,
      args.organizationId
    );
    return {
      _id: org._id,
      name: org.name,
      taxId: org.taxId,
      ownerCustomerId: org.ownerCustomerId,
      createdAt: org.createdAt,
    };
  },
});

// ============================================================================
// getOrganizationByOwner — resolve the org a customer owns (post sign-in)
// ============================================================================
//
// PUBLIC query. The Next.js layer calls this with the cookie-derived
// callerCustomerId to find the org they own (so the console can route them).
// Self-scoped by construction: it only ever returns the org whose
// ownerCustomerId equals the caller — there is no cross-org read surface.
export const getOrganizationByOwner = query({
  args: { callerCustomerId: v.id("lmsCustomers") },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("lmsOrganizations")
      .withIndex("by_owner", (q) =>
        q.eq("ownerCustomerId", args.callerCustomerId)
      )
      .first();
    if (!org || org.deletedAt) return null;
    return {
      _id: org._id,
      name: org.name,
      taxId: org.taxId,
      ownerCustomerId: org.ownerCustomerId,
      createdAt: org.createdAt,
    };
  },
});
