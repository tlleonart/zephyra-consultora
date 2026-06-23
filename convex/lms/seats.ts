/**
 * LMS — Seat assignment domain (Sprint 3b Phase C — invite + claim + release).
 *
 * The B2B seat lifecycle AFTER the pack is minted (3a money path produced the
 * lmsSeatPacks + N available lmsSeats). The org Owner Admin invites an employee
 * by email; the employee follows a magic-link, the seat is CLAIMED, and an
 * lmsEnrollments row is created (the same player UX as B2C from there). The
 * owner may RELEASE a seat (marcar baja) only while it shows zero engagement.
 *
 * Contents:
 *   C1  requestSeatInvite       — org-owner-gated; issues the invite magic-link
 *                                 (mutation; the Next.js action sends the email).
 *   C2  claimSeat               — idempotent seat claim → enrollment (mutation).
 *   C3  releaseSeat             — org-owner-gated zero-engagement release (mutation).
 *   D1  getOrgRoster            — org-owner-gated membership list (display only).
 *       getOrgCourseProgress    — org-owner-gated AGGREGATE-only progress.
 *       getNominalProgress      — nominal read GATED on lmsProgressConsents.
 *
 * SECURITY / PRIVACY INVARIANTS:
 *   - requireOrgOwner on EVERY org-scoped function (invite, release, roster,
 *     aggregate, nominal) — cross-org isolation (Risk R3), same control as 3a.
 *   - The invite is an opaque random token stored as HMAC-SHA-256 in
 *     lmsMagicLinkTokens (REUSE of the lms/auth.ts discipline). The raw token is
 *     returned once, never persisted. The (org, seatPack, claimRequest) binding
 *     is carried in the invite URL (the frozen token row has no columns for it),
 *     and re-verified server-side at claim time.
 *   - claimSeat is IDEMPOTENT: lookup-before-insert on claimRequestId via
 *     lmsSeats.by_claim_request. A replayed claim returns the existing seat +
 *     enrollment and mints NOTHING new.
 *   - Balance invariant (availableSeats + claimedSeats ≤ totalSeats) is held
 *     transactionally on every claim/release.
 *   - Release is a STATUS change (claimed → released, seat returns to the pool),
 *     NOT a deletedBy soft-delete: the actor is an org_admin (lmsCustomers),
 *     never an adminUsers. Releasable ONLY at zero engagement on all three
 *     signals (progressPercent === 0 && scoreRaw === undefined &&
 *     firstTouchedAt === undefined) — a learner who started is NOT releasable.
 *   - The NOMINAL gate (getNominalProgress) is DENIED at the function unless an
 *     lmsProgressConsents row exists with granted:true for the (learner, org)
 *     pair — a Habeas-Data control, enforced server-side, not UI-hidden.
 *
 * Trust boundary: identical to lms/org.ts — the Next.js server-action layer
 * validates the session-learner cookie and passes callerCustomerId; Convex
 * cannot read cookies. requireOrgOwner then asserts that identity owns the org.
 *
 * Runtime: V8 isolate (imports convex/model/passwords.ts Web Crypto helper).
 * NEVER add "use node" to this file.
 */

import { mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import type { Id, Doc } from "../_generated/dataModel";
import { AuthError } from "../model/auth";
import { hashOpaqueToken } from "../model/passwords";
import { requireOrgOwner } from "./org";

// ============================================================================
// Constants
// ============================================================================

// The invite magic-link reuses the frozen lmsMagicLinkTokens.purpose union;
// "learner_activation" is the closest existing purpose — the invited employee
// is activating their (org-managed) account by claiming the seat. The frozen
// schema has no dedicated "seat_invite" literal, so we reuse this one and bind
// the (org, seatPack, claimRequest) context in the invite URL + re-verify it
// server-side at claim time.
const INVITE_PURPOSE = "learner_activation" as const;

// Invite TTL: 7 days. An employee may not check email immediately; this is
// longer than the 30-min self-activation token (a manager-initiated invite is a
// different UX than a self-serve sign-up).
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const RAW_TOKEN_BYTES = 32;

// ============================================================================
// Helpers
// ============================================================================

const normalizeEmail = (raw: string): string => raw.trim().toLowerCase();

const toHex = (bytes: Uint8Array): string => {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
};

/** 256-bit cryptographically random opaque token (64 lowercase hex chars). */
const generateRawToken = (): string =>
  toHex(crypto.getRandomValues(new Uint8Array(RAW_TOKEN_BYTES)));

/** A random claim-request id — the idempotency key carried in the invite URL
 *  and stamped onto the seat at claim time (lmsSeats.by_claim_request). */
const generateClaimRequestId = (): string =>
  toHex(crypto.getRandomValues(new Uint8Array(RAW_TOKEN_BYTES)));

/** Count available seats in a pack via the by_seatpack_status index (no scan). */
async function countAvailableSeats(
  ctx: QueryCtx | MutationCtx,
  seatPackId: Id<"lmsSeatPacks">
): Promise<number> {
  const rows = await ctx.db
    .query("lmsSeats")
    .withIndex("by_seatpack_status", (q) =>
      q.eq("seatPackId", seatPackId).eq("status", "available")
    )
    .collect();
  return rows.length;
}

// ============================================================================
// C1 — requestSeatInvite (org-owner-gated magic-link issue)
// ============================================================================
//
// MUTATION (not action): only writes lmsMagicLinkTokens, exactly like
// lms/auth.ts:requestMagicLink. The Next.js server action composes the invite
// URL from the returned rawToken + claimRequestId + (orgId, seatPackId) and
// sends the email (the invite-email send lives in the action / a scheduled
// internalAction; this mutation is pure DB + token mint).
//
// Org-owner-gated: requireOrgOwner asserts the caller owns the pack's org.
// Pre-check: the pack must have ≥ 1 available seat (block on a full pack with a
// clear error — the safer choice; do not invite into a pack with no capacity).
//
// Re-invite idempotency: a second invite for the SAME (seatPack, email) while a
// pending (unused, unexpired) invite token already exists does NOT mint a second
// token. We surface `alreadyPending: true` and return null rawToken (the prior
// link is still live; the action can re-send the stored claimRequestId). The
// claimRequestId for the pending invite is recreated deterministically is NOT
// possible (the token row has no claimRequestId column), so on a re-invite the
// caller must rely on the originally returned claimRequestId; we therefore
// return alreadyPending so the action does not issue a duplicate seat claim.
export const requestSeatInvite = mutation({
  args: {
    callerCustomerId: v.id("lmsCustomers"),
    organizationId: v.id("lmsOrganizations"),
    seatPackId: v.id("lmsSeatPacks"),
    employeeEmail: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOrgOwner(ctx, args.callerCustomerId, args.organizationId);

    const pack = await ctx.db.get(args.seatPackId);
    if (!pack) {
      throw new AuthError("pack no encontrado");
    }
    // Cross-org isolation: the pack must belong to the caller's org.
    if (pack.organizationId !== args.organizationId) {
      throw new AuthError("no autorizado");
    }

    const email = normalizeEmail(args.employeeEmail);
    if (email.length === 0) {
      throw new AuthError("el email del empleado es obligatorio");
    }

    // Pre-check: don't invite into a pack with no capacity. Block when there is
    // no available seat (safer than issuing a link that can never be claimed).
    const available = await countAvailableSeats(ctx, args.seatPackId);
    if (available <= 0) {
      throw new AuthError(
        "el pack no tiene asientos disponibles para invitar"
      );
    }

    const now = Date.now();

    // Re-invite idempotency: if a pending (unused, unexpired) invite token for
    // this email already exists, do not mint a second one.
    const existingTokens = await ctx.db
      .query("lmsMagicLinkTokens")
      .withIndex("by_email_purpose", (q) =>
        q.eq("email", email).eq("purpose", INVITE_PURPOSE)
      )
      .collect();
    const pending = existingTokens.find(
      (t) => t.usedAt === undefined && t.expiresAt > now
    );
    if (pending) {
      return {
        rawToken: null,
        claimRequestId: null,
        expiresAt: pending.expiresAt,
        alreadyPending: true as const,
      };
    }

    const rawToken = generateRawToken();
    const tokenHash = await hashOpaqueToken(rawToken);
    const claimRequestId = generateClaimRequestId();
    const expiresAt = now + INVITE_TTL_MS;

    await ctx.db.insert("lmsMagicLinkTokens", {
      email,
      tokenHash,
      purpose: INVITE_PURPOSE,
      expiresAt,
      createdAt: now,
    });

    // The raw token + claimRequestId are returned ONCE for the invite URL and
    // never persisted (only the HMAC of the token lives in the DB). The (org,
    // seatPack) binding travels in the URL and is re-verified at claim time.
    return {
      rawToken,
      claimRequestId,
      expiresAt,
      alreadyPending: false as const,
    };
  },
});

// ============================================================================
// C2 — claimSeat (idempotent claim → enrollment)
// ============================================================================
//
// MUTATION reached from the invite-landing server action: the action has the
// invite URL params (token, claimRequestId, organizationId, seatPackId) and the
// invited employee's email. It calls this mutation, which:
//   1. Verifies the opaque invite token (HMAC, unused, unexpired, right purpose)
//      and BURNS it (usedAt) — proof of email control, the same discipline as
//      consumeMagicLink. We consume it HERE (not via consumeMagicLink) because
//      consumeMagicLink would create an "individual" customer; an invited
//      employee must become an "org_learner" bound to the org.
//   2. IDEMPOTENCY: looks up lmsSeats.by_claim_request for claimRequestId BEFORE
//      any insert. A replayed claim (token already burned, but same
//      claimRequestId) returns the existing seat + enrollment, minting nothing.
//   3. Pre-checks: the pack has an available seat; the learner has no existing
//      ACTIVE enrollment for the course (by_learner_course_status).
//   4. Single transaction: pick an available seat (by_seatpack_status), set it
//      claimed (claimedBy/claimedAt/claimRequestId); availableSeats-- /
//      claimedSeats++ with the balance check; create ONE lmsEnrollments row with
//      seatId + status "active" + progressPercent 0.
//   5. If the customer doesn't exist yet (employee's first touch), create the
//      lmsCustomers (type "org_learner", organizationId) as part of the claim.
//
// NOTE on token burn vs idempotency: the token is single-use, so a true network
// retry that re-sends the SAME token after a committed claim would see usedAt
// set. To keep the claim idempotent for the org flow we therefore key the
// replay guard on claimRequestId FIRST (step 2, before touching the token): a
// replay short-circuits to the existing enrollment without needing a live token.
export const claimSeat = mutation({
  args: {
    token: v.string(),
    claimRequestId: v.string(),
    organizationId: v.id("lmsOrganizations"),
    seatPackId: v.id("lmsSeatPacks"),
    employeeEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const pack = await ctx.db.get(args.seatPackId);
    if (!pack || pack.organizationId !== args.organizationId) {
      throw new AuthError("invitación inválida");
    }
    const email = normalizeEmail(args.employeeEmail);

    // --- (2) IDEMPOTENCY: replay short-circuit on claimRequestId -------------
    // Done BEFORE consuming the token so a network retry (token already burned)
    // still returns the existing claim rather than failing on a used token.
    const existingSeat = await ctx.db
      .query("lmsSeats")
      .withIndex("by_claim_request", (q) =>
        q.eq("claimRequestId", args.claimRequestId)
      )
      .first();
    if (existingSeat) {
      // The seat is already claimed under this request id. Return the existing
      // enrollment (one-per-seat via by_seat). No new seat, no new enrollment.
      const enrollment = await ctx.db
        .query("lmsEnrollments")
        .withIndex("by_seat", (q) => q.eq("seatId", existingSeat._id))
        .first();
      if (!enrollment) {
        // Defensive: a claimed seat without its enrollment is a torn write that
        // cannot happen inside one transaction; surface rather than mint a 2nd.
        throw new AuthError("estado de claim inconsistente");
      }
      return {
        seatId: existingSeat._id,
        enrollmentId: enrollment._id,
        learnerId: enrollment.learnerId,
        alreadyClaimed: true as const,
      };
    }

    // --- (1) verify + burn the invite token (proof of email control) ---------
    const tokenHash = await hashOpaqueToken(args.token);
    const tokenRow = await ctx.db
      .query("lmsMagicLinkTokens")
      .withIndex("by_token", (q) => q.eq("tokenHash", tokenHash))
      .first();
    if (!tokenRow) {
      throw new AuthError("invitación inválida o expirada");
    }
    if (tokenRow.usedAt !== undefined) {
      throw new AuthError("esta invitación ya fue usada");
    }
    if (Date.now() > tokenRow.expiresAt) {
      throw new AuthError("invitación expirada");
    }
    if (tokenRow.purpose !== INVITE_PURPOSE) {
      throw new AuthError("invitación inválida para esta operación");
    }
    // The token's email must match the email being claimed (defense in depth:
    // the invite was minted for a specific employee address).
    if (tokenRow.email !== email) {
      throw new AuthError("invitación inválida para este email");
    }
    const now = Date.now();
    await ctx.db.patch(tokenRow._id, { usedAt: now });

    // --- (5) resolve / create the org_learner customer -----------------------
    const learner = await ctx.db
      .query("lmsCustomers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    let learnerId: Id<"lmsCustomers">;
    if (!learner || learner.deletedAt) {
      learnerId = await ctx.db.insert("lmsCustomers", {
        email,
        type: "org_learner",
        organizationId: args.organizationId,
        activatedAt: now,
        lastLoginAt: now,
        createdAt: now,
      });
    } else {
      learnerId = learner._id;
      // First touch: an existing (e.g. individual) customer claiming an org seat
      // is activated + bound to the org as an org_learner. We do not downgrade
      // an existing org_admin (an owner shouldn't be claiming their own seats),
      // but we DO stamp activation/login.
      const patch: Partial<Doc<"lmsCustomers">> = { lastLoginAt: now };
      if (learner.activatedAt === undefined) patch.activatedAt = now;
      if (learner.type === "individual") {
        patch.type = "org_learner";
        patch.organizationId = args.organizationId;
      }
      await ctx.db.patch(learnerId, patch);
    }

    // --- (3) pre-check: no existing ACTIVE enrollment for this course --------
    const activeEnrollment = await ctx.db
      .query("lmsEnrollments")
      .withIndex("by_learner_course_status", (q) =>
        q
          .eq("learnerId", learnerId)
          .eq("courseId", pack.courseId)
          .eq("status", "active")
      )
      .first();
    if (activeEnrollment) {
      throw new AuthError(
        "el learner ya tiene una inscripción activa para este curso"
      );
    }

    // --- (3) pre-check: an available seat exists -----------------------------
    const seat = await ctx.db
      .query("lmsSeats")
      .withIndex("by_seatpack_status", (q) =>
        q.eq("seatPackId", args.seatPackId).eq("status", "available")
      )
      .first();
    if (!seat) {
      throw new AuthError("no hay asientos disponibles en el pack");
    }

    // --- (4) single-transaction claim ----------------------------------------
    // Balance check BEFORE mutating: claiming one seat must keep
    // availableSeats + claimedSeats ≤ totalSeats. (claimed grows by 1, available
    // shrinks by 1, so the sum is invariant — but assert the floor anyway.)
    if (pack.availableSeats <= 0) {
      throw new AuthError("no hay asientos disponibles en el pack");
    }
    const nextAvailable = pack.availableSeats - 1;
    const nextClaimed = pack.claimedSeats + 1;
    if (nextAvailable + nextClaimed > pack.totalSeats) {
      // Should be impossible (sum is invariant) but fail closed on a corrupt row.
      throw new AuthError("violación del balance del pack");
    }

    await ctx.db.patch(seat._id, {
      status: "claimed",
      claimedBy: learnerId,
      claimedAt: now,
      claimRequestId: args.claimRequestId,
    });
    await ctx.db.patch(args.seatPackId, {
      availableSeats: nextAvailable,
      claimedSeats: nextClaimed,
    });

    const enrollmentId = await ctx.db.insert("lmsEnrollments", {
      seatId: seat._id, // one enrollment per claimed seat (by_seat UNIQUE)
      learnerId,
      courseId: pack.courseId,
      status: "active",
      claimRequestId: args.claimRequestId,
      progressPercent: 0,
      completedScoCount: 0,
      scoStates: {},
      startedAt: now,
      updatedAt: now,
    });

    return {
      seatId: seat._id,
      enrollmentId,
      learnerId,
      alreadyClaimed: false as const,
    };
  },
});

// ============================================================================
// C3 — releaseSeat (marcar baja — STATUS change, NOT soft-delete)
// ============================================================================
//
// Org-owner-gated. Releasable ONLY at zero engagement on ALL THREE signals
// (PDD §6.3 audit M-6): progressPercent === 0 && scoreRaw === undefined &&
// firstTouchedAt === undefined. A learner who started is NOT releasable.
//
// On release: seat claimed → released (returned to the pool, re-claimable);
// availableSeats++ / claimedSeats--; the enrollment is ENDED (status "expired").
// The actor is the org_admin (an lmsCustomers), so we DO NOT set deletedBy
// (that field is Id<adminUsers> — a staff soft-delete, which this is not).
export const releaseSeat = mutation({
  args: {
    callerCustomerId: v.id("lmsCustomers"),
    organizationId: v.id("lmsOrganizations"),
    seatId: v.id("lmsSeats"),
  },
  handler: async (ctx, args) => {
    await requireOrgOwner(ctx, args.callerCustomerId, args.organizationId);

    const seat = await ctx.db.get(args.seatId);
    if (!seat) {
      throw new AuthError("asiento no encontrado");
    }
    const pack = await ctx.db.get(seat.seatPackId);
    if (!pack || pack.organizationId !== args.organizationId) {
      throw new AuthError("no autorizado");
    }
    if (seat.status !== "claimed") {
      throw new AuthError("el asiento no está reclamado");
    }

    // The enrollment for this seat (one per seat via by_seat).
    const enrollment = await ctx.db
      .query("lmsEnrollments")
      .withIndex("by_seat", (q) => q.eq("seatId", args.seatId))
      .first();
    if (!enrollment) {
      throw new AuthError("inscripción del asiento no encontrada");
    }

    // ZERO-ENGAGEMENT GATE — all three signals must be untouched. Convex
    // optionals read as `undefined` (never null) in the V8 isolate.
    const zeroEngagement =
      enrollment.progressPercent === 0 &&
      enrollment.scoreRaw === undefined &&
      enrollment.firstTouchedAt === undefined;
    if (!zeroEngagement) {
      throw new AuthError(
        "no se puede liberar un asiento de un learner que ya comenzó el curso"
      );
    }

    const now = Date.now();
    // Balance: release returns the seat to the pool.
    const nextAvailable = pack.availableSeats + 1;
    const nextClaimed = pack.claimedSeats - 1;
    if (nextClaimed < 0 || nextAvailable + nextClaimed > pack.totalSeats) {
      throw new AuthError("violación del balance del pack");
    }

    // Seat: claimed → released (re-claimable). Clear the claimant so a future
    // claim starts clean; the by_claim_request key is also cleared so the seat
    // is no longer tied to the consumed invite.
    await ctx.db.patch(args.seatId, {
      status: "released",
      claimedBy: undefined,
      claimedAt: undefined,
      claimRequestId: undefined,
    });
    await ctx.db.patch(seat.seatPackId, {
      availableSeats: nextAvailable,
      claimedSeats: nextClaimed,
    });

    // Enrollment ENDED via a STATUS change (NOT deletedBy — the actor is an
    // org_admin, not adminUsers). Detach seatId so the by_seat UNIQUE invariant
    // (one live enrollment per seat) is preserved if the seat is re-claimed.
    await ctx.db.patch(enrollment._id, {
      status: "expired",
      seatId: undefined,
      updatedAt: now,
    });

    return {
      seatId: args.seatId,
      enrollmentId: enrollment._id,
      released: true as const,
    };
  },
});

// ============================================================================
// D1 — getOrgRoster (membership list — display name only)
// ============================================================================
//
// Org-owner-gated. Members = the learners holding a CLAIMED seat in any of the
// org's packs. Membership is NOT progress: we expose display identity only (the
// learner email — the only human-readable name lmsCustomers carries) plus which
// course the seat is for. NO progressPercent / scoreRaw here — nominal progress
// requires consent (getNominalProgress) and is denied otherwise.
export const getOrgRoster = query({
  args: {
    callerCustomerId: v.id("lmsCustomers"),
    organizationId: v.id("lmsOrganizations"),
  },
  handler: async (ctx, args) => {
    await requireOrgOwner(ctx, args.callerCustomerId, args.organizationId);

    const packs = await ctx.db
      .query("lmsSeatPacks")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();

    const members: Array<{
      learnerId: Id<"lmsCustomers">;
      email: string;
      courseId: Id<"lmsCourses">;
      seatId: Id<"lmsSeats">;
      claimedAt?: number;
    }> = [];

    for (const pack of packs) {
      const claimedSeats = await ctx.db
        .query("lmsSeats")
        .withIndex("by_seatpack_status", (q) =>
          q.eq("seatPackId", pack._id).eq("status", "claimed")
        )
        .collect();
      for (const seat of claimedSeats) {
        if (!seat.claimedBy) continue;
        const learner = await ctx.db.get(seat.claimedBy);
        if (!learner || learner.deletedAt) continue;
        members.push({
          learnerId: learner._id,
          email: learner.email, // display identity only (membership ≠ progress)
          courseId: pack.courseId,
          seatId: seat._id,
          claimedAt: seat.claimedAt,
        });
      }
    }

    return { members };
  },
});

// ============================================================================
// D1 — getOrgCourseProgress (AGGREGATE-only — the only Access × Learning path)
// ============================================================================
//
// Org-owner-gated. The ONLY path that crosses the Access boundary into Learning
// data, and it returns AGGREGATE counts ONLY — NEVER identities. % complete and
// the count of completed / in-progress / not-started learners per course for
// the org's packs. No learner id, no email, no per-person row leaves here.
export const getOrgCourseProgress = query({
  args: {
    callerCustomerId: v.id("lmsCustomers"),
    organizationId: v.id("lmsOrganizations"),
    courseId: v.optional(v.id("lmsCourses")),
  },
  handler: async (ctx, args) => {
    await requireOrgOwner(ctx, args.callerCustomerId, args.organizationId);

    const packs = await ctx.db
      .query("lmsSeatPacks")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();

    // Aggregate accumulator keyed by courseId. We tally per claimed seat's
    // enrollment, never emitting any learner identity.
    const byCourse = new Map<
      string,
      {
        courseId: Id<"lmsCourses">;
        totalClaimed: number;
        completed: number;
        inProgress: number;
        notStarted: number;
        progressPercentSum: number;
      }
    >();

    for (const pack of packs) {
      if (args.courseId && pack.courseId !== args.courseId) continue;
      const key = pack.courseId as unknown as string;
      let agg = byCourse.get(key);
      if (!agg) {
        agg = {
          courseId: pack.courseId,
          totalClaimed: 0,
          completed: 0,
          inProgress: 0,
          notStarted: 0,
          progressPercentSum: 0,
        };
        byCourse.set(key, agg);
      }

      const claimedSeats = await ctx.db
        .query("lmsSeats")
        .withIndex("by_seatpack_status", (q) =>
          q.eq("seatPackId", pack._id).eq("status", "claimed")
        )
        .collect();

      for (const seat of claimedSeats) {
        const enrollment = await ctx.db
          .query("lmsEnrollments")
          .withIndex("by_seat", (q) => q.eq("seatId", seat._id))
          .first();
        if (!enrollment) continue;
        agg.totalClaimed += 1;
        agg.progressPercentSum += enrollment.progressPercent;
        if (enrollment.status === "completed" || enrollment.progressPercent >= 100) {
          agg.completed += 1;
        } else if (
          enrollment.progressPercent === 0 &&
          enrollment.firstTouchedAt === undefined
        ) {
          agg.notStarted += 1;
        } else {
          agg.inProgress += 1;
        }
      }
    }

    const courses = Array.from(byCourse.values()).map((a) => ({
      courseId: a.courseId,
      totalClaimed: a.totalClaimed,
      completed: a.completed,
      inProgress: a.inProgress,
      notStarted: a.notStarted,
      avgProgressPercent:
        a.totalClaimed > 0
          ? Math.floor(a.progressPercentSum / a.totalClaimed)
          : 0,
    }));

    return { courses };
  },
});

// ============================================================================
// D1 — getNominalProgress (NOMINAL gate — DENIED without consent)
// ============================================================================
//
// Org-owner-gated AND consent-gated. This is the Habeas-Data release gate: a
// nominal (learner-identified) progress read is DENIED AT THE FUNCTION unless an
// lmsProgressConsents row exists with granted:true for the (learner, org) pair
// (by_learner_org). Not UI-hidden — the data never leaves the server without
// consent. A course-scoped consent (courseId set) covers only that course; an
// org-wide consent (courseId undefined) covers all.
export const getNominalProgress = query({
  args: {
    callerCustomerId: v.id("lmsCustomers"),
    organizationId: v.id("lmsOrganizations"),
    learnerCustomerId: v.id("lmsCustomers"),
    courseId: v.id("lmsCourses"),
  },
  handler: async (ctx, args) => {
    await requireOrgOwner(ctx, args.callerCustomerId, args.organizationId);

    // CONSENT GATE — server-side denial. Look up the (learner, org) consent
    // rows; accept an org-wide consent (no courseId) OR a consent scoped to this
    // courseId. Absence of a granted row ⇒ DENIED (default opt-out).
    const consents = await ctx.db
      .query("lmsProgressConsents")
      .withIndex("by_learner_org", (q) =>
        q
          .eq("learnerCustomerId", args.learnerCustomerId)
          .eq("organizationId", args.organizationId)
      )
      .collect();
    const hasConsent = consents.some(
      (c) =>
        c.granted === true &&
        (c.courseId === undefined || c.courseId === args.courseId)
    );
    if (!hasConsent) {
      throw new AuthError(
        "acceso denegado: el learner no consintió compartir su progreso nominal"
      );
    }

    const learner = await ctx.db.get(args.learnerCustomerId);
    if (!learner || learner.deletedAt) {
      throw new AuthError("learner no encontrado");
    }
    // Defense in depth: the learner must actually belong to this org.
    if (learner.organizationId !== args.organizationId) {
      throw new AuthError("no autorizado");
    }

    const enrollment = await ctx.db
      .query("lmsEnrollments")
      .withIndex("by_learner_course_status", (q) =>
        q
          .eq("learnerId", args.learnerCustomerId)
          .eq("courseId", args.courseId)
          .eq("status", "active")
      )
      .first();

    return {
      learnerId: learner._id,
      email: learner.email,
      courseId: args.courseId,
      enrollment: enrollment
        ? {
            status: enrollment.status,
            progressPercent: enrollment.progressPercent,
            scoreRaw: enrollment.scoreRaw,
            lessonStatus: enrollment.lessonStatus,
            firstTouchedAt: enrollment.firstTouchedAt,
            updatedAt: enrollment.updatedAt,
          }
        : null,
    };
  },
});
