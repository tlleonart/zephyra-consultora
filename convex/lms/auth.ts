/**
 * LMS — Learner auth backend (Sprint 1 C01).
 *
 * Learner identity is separate from `adminUsers` (PDD §7.5 + SDD §6 SC #3):
 *   - Magic-link is the PRIMARY auth path (activation + sign-in + recovery).
 *   - Password is OPTIONAL and only present once a learner opts to set one.
 *   - Distinct signing key from the admin JWT (the `session-learner` cookie
 *     is minted by C03 in the Next.js server action layer).
 *
 * Why NO `requireAuth` / `userId: Id<"adminUsers">` gating here:
 *   Learner auth boundary — these functions ARE the auth check; no upstream
 *   admin gate. The B02 pattern applies to admin-gated LMS surfaces; this
 *   file is the deliberate exception. The C03 server action layer derives
 *   the learner identity from the `session-learner` cookie BEFORE calling
 *   into mutations that take a `learnerId` arg (setLearnerPassword), and
 *   the magic-link / password mutations are self-authenticating by
 *   construction (the token / credentials ARE the proof).
 *
 * Why uniform error messages on sign-in failures:
 *   Defeats account-enumeration: a leaked "this email has no password set"
 *   message would let an attacker map which emails are learners. The admin
 *   `requestPasswordReset` uses the same anti-enumeration shape.
 *
 * Runtime: V8 isolate. Imports `convex/model/passwords.ts` (Web Crypto +
 * hash-wasm). NEVER add `"use node"` to this file.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import {
  hashPassword,
  hashOpaqueToken,
  verifyPassword,
} from "../model/passwords";
import { AuthError } from "../model/auth";

// ============================================================================
// Constants
// ============================================================================

const ACTIVATION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const SIGNIN_RECOVERY_TTL_MS = 15 * 60 * 1000; // 15 minutes
const RAW_TOKEN_BYTES = 32;
const MIN_PASSWORD_LENGTH = 8;
const NON_ALPHANUM_RE = /[^A-Za-z0-9]/;

type LearnerPurpose =
  | "learner_activation"
  | "learner_signin"
  | "learner_recovery";

// ============================================================================
// Helpers
// ============================================================================

/** Normalize a learner-supplied email. Trim + lowercase. Used by every
 *  mutation that compares against `lmsCustomers.email` or stores into
 *  `lmsMagicLinkTokens.email`. */
const normalizeEmail = (raw: string): string => raw.trim().toLowerCase();

/** Convert a Uint8Array to lowercase hex. Inline helper (the file in
 *  passwords.ts has its own private copy; duplicated intentionally to
 *  keep this module self-contained for the V8 isolate). */
const toHex = (bytes: Uint8Array): string => {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
};

/** Generate a cryptographically random opaque token. 32 bytes = 256 bits of
 *  entropy, encoded as 64 lowercase hex chars. */
const generateRawToken = (): string =>
  toHex(crypto.getRandomValues(new Uint8Array(RAW_TOKEN_BYTES)));

/** TTL in ms for a given purpose. Exhaustive over the purpose union. */
const ttlForPurpose = (purpose: LearnerPurpose): number => {
  switch (purpose) {
    case "learner_activation":
      return ACTIVATION_TTL_MS;
    case "learner_signin":
    case "learner_recovery":
      return SIGNIN_RECOVERY_TTL_MS;
  }
};

// Reusable arg validator for the purpose union.
const purposeValidator = v.union(
  v.literal("learner_activation"),
  v.literal("learner_signin"),
  v.literal("learner_recovery")
);

// Shape returned to the calling server action after consume/sign-in. Excludes
// `passwordHash` (the C03 cookie session never sees it).
interface LearnerSessionPayload {
  _id: string;
  email: string;
  type: "individual" | "org_admin" | "org_learner";
  activatedAt?: number;
  organizationId?: string;
}

// ============================================================================
// requestMagicLink — mint a magic-link token
// ============================================================================
//
// Mutation (not action): only writes to lmsMagicLinkTokens. Mailer send
// happens in the Next.js server action (C02 wiring) — the action calls this
// mutation, then composes the URL with the returned rawToken and sends.
//
// The raw token is RETURNED but NEVER persisted; only the HMAC hash lives in
// the DB. If the server action crashes after this returns, the token is lost
// and the learner must re-request — that's the right failure mode.
export const requestMagicLink = mutation({
  args: {
    email: v.string(),
    purpose: purposeValidator,
    fromIp: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);

    const customer = await ctx.db
      .query("lmsCustomers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    // Sign-in / recovery require the learner to already exist; surface
    // "usuario no encontrado" intentionally (same UX as the admin
    // password-reset flow, which is also tolerant of enumeration for the
    // reset path). Activation is the one path that may create a new row.
    if (
      args.purpose === "learner_signin" ||
      args.purpose === "learner_recovery"
    ) {
      if (!customer || customer.deletedAt) {
        throw new AuthError("usuario no encontrado");
      }
    }

    // Activation short-circuit: already-activated customers don't need a new
    // activation token; surface that so the UI can redirect to /cursos/auth/signin.
    if (
      args.purpose === "learner_activation" &&
      customer &&
      !customer.deletedAt &&
      customer.activatedAt !== undefined
    ) {
      return { rawToken: null, expiresAt: null, alreadyActivated: true };
    }

    const rawToken = generateRawToken();
    const tokenHash = await hashOpaqueToken(rawToken);
    const now = Date.now();
    const expiresAt = now + ttlForPurpose(args.purpose);

    await ctx.db.insert("lmsMagicLinkTokens", {
      email,
      tokenHash,
      purpose: args.purpose,
      expiresAt,
      createdAt: now,
      createdFromIp: args.fromIp,
    });

    return { rawToken, expiresAt, alreadyActivated: false };
  },
});

// ============================================================================
// consumeMagicLink — verify + burn a magic-link token
// ============================================================================
//
// Single-use enforced atomically: the patch that sets `usedAt` runs in the
// same Convex transaction as the lookup, so a second consume of the same
// token sees `usedAt !== undefined` and throws.
export const consumeMagicLink = mutation({
  args: {
    token: v.string(),
    purpose: purposeValidator,
  },
  handler: async (ctx, args) => {
    const tokenHash = await hashOpaqueToken(args.token);

    const row = await ctx.db
      .query("lmsMagicLinkTokens")
      .withIndex("by_token", (q) => q.eq("tokenHash", tokenHash))
      .first();

    if (!row) {
      throw new AuthError("link inválido o expirado");
    }
    if (row.usedAt !== undefined) {
      throw new AuthError("este link ya fue usado");
    }
    if (Date.now() > row.expiresAt) {
      throw new AuthError("link expirado");
    }
    // Cross-purpose escalation guard: an activation token must not be
    // accepted on the sign-in path (and vice-versa).
    if (row.purpose !== args.purpose) {
      throw new AuthError("link inválido para esta operación");
    }

    const now = Date.now();
    await ctx.db.patch(row._id, { usedAt: now });

    const email = row.email; // already normalized at mint time

    let customer = await ctx.db
      .query("lmsCustomers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    switch (args.purpose) {
      case "learner_activation": {
        if (!customer || customer.deletedAt) {
          // Activation creates the row on first consume. Default type is
          // "individual"; org-managed learners are created upstream by an
          // admin and only land on the signin/recovery paths.
          const newId = await ctx.db.insert("lmsCustomers", {
            email,
            type: "individual",
            createdAt: now,
            activatedAt: now,
            lastLoginAt: now,
          });
          customer = await ctx.db.get(newId);
        } else {
          await ctx.db.patch(customer._id, {
            activatedAt: now,
            lastLoginAt: now,
          });
          customer = await ctx.db.get(customer._id);
        }
        break;
      }
      case "learner_signin":
      case "learner_recovery": {
        if (!customer || customer.deletedAt) {
          throw new AuthError("usuario no encontrado");
        }
        await ctx.db.patch(customer._id, { lastLoginAt: now });
        customer = await ctx.db.get(customer._id);
        break;
      }
    }

    if (!customer) {
      // Defensive: insert+get round-trip should never miss in a single
      // transaction, but if it does, surface a clear error rather than
      // returning a malformed payload to the cookie minter.
      throw new AuthError("learner no encontrado tras consumir link");
    }

    const payload: LearnerSessionPayload = {
      _id: customer._id,
      email: customer.email,
      type: customer.type,
      activatedAt: customer.activatedAt,
      organizationId: customer.organizationId,
    };
    return { customer: payload };
  },
});

// ============================================================================
// setLearnerPassword — set / change a learner's password
// ============================================================================
//
// Called by the C03 server action AFTER it has verified the
// `session-learner` cookie and extracted the learner identity. The arg
// `learnerId` is therefore trusted; this mutation does NOT re-verify cookie
// identity (Convex mutations cannot read cookies).
export const setLearnerPassword = mutation({
  args: {
    learnerId: v.id("lmsCustomers"),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.learnerId);
    if (!customer || customer.deletedAt) {
      throw new AuthError("learner no encontrado");
    }

    if (args.password.length < MIN_PASSWORD_LENGTH) {
      throw new AuthError(
        `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`
      );
    }
    if (!NON_ALPHANUM_RE.test(args.password)) {
      throw new AuthError(
        "La contraseña debe incluir al menos un carácter no alfanumérico"
      );
    }

    const passwordHash = await hashPassword(args.password);
    await ctx.db.patch(args.learnerId, { passwordHash });

    return { ok: true };
  },
});

// ============================================================================
// signInLearnerWithPassword — credentials path
// ============================================================================
//
// Returns a uniform "credenciales inválidas" on EVERY failure mode to defeat
// account enumeration:
//   - email not registered
//   - learner soft-deleted
//   - learner never set a password (passwordHash undefined)
//   - wrong password
// All four collapse to the same string; logs can disambiguate server-side.
export const signInLearnerWithPassword = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);

    const customer = await ctx.db
      .query("lmsCustomers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (
      !customer ||
      customer.deletedAt ||
      customer.passwordHash === undefined
    ) {
      throw new AuthError("credenciales inválidas");
    }

    const result = await verifyPassword(args.password, customer.passwordHash);
    if (!result.valid) {
      throw new AuthError("credenciales inválidas");
    }

    const now = Date.now();
    const patch: { lastLoginAt: number; passwordHash?: string } = {
      lastLoginAt: now,
    };
    // Lazy re-hash for legacy hashes. Learners are post-B01 so this is a
    // dead-but-correct branch; mirrors the admin login path.
    if (result.needsRehash) {
      patch.passwordHash = await hashPassword(args.password);
    }
    await ctx.db.patch(customer._id, patch);

    const payload: LearnerSessionPayload = {
      _id: customer._id,
      email: customer.email,
      type: customer.type,
      activatedAt: customer.activatedAt,
      organizationId: customer.organizationId,
    };
    return { customer: payload };
  },
});

// ============================================================================
// getLearnerById — server-side session refresh
// ============================================================================
//
// Used by the C03 server action to refresh the cookie payload on each
// request (avoids stale `activatedAt` / `type` in the JWT). Strips
// `passwordHash` so the cookie minter never even sees it in scope.
export const getLearnerById = query({
  args: { learnerId: v.id("lmsCustomers") },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.learnerId);
    if (!customer || customer.deletedAt) return null;
    const { passwordHash: _passwordHash, ...rest } = customer;
    void _passwordHash;
    return rest;
  },
});
