import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

export type AdminRole = "superadmin" | "admin";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Get the current authenticated admin user from the session
 * Returns null if not authenticated
 */
export const getAuthenticatedAdmin = async (
  ctx: QueryCtx | MutationCtx,
  userId?: Id<"adminUsers">
) => {
  if (!userId) {
    return null;
  }

  const user = await ctx.db.get(userId);
  if (!user || user.deletedAt || !user.isActive) {
    return null;
  }

  return user;
};

/**
 * Require authentication - throws if not authenticated
 */
export const requireAuth = async (
  ctx: QueryCtx | MutationCtx,
  userId?: Id<"adminUsers">
) => {
  const user = await getAuthenticatedAdmin(ctx, userId);
  if (!user) {
    throw new AuthError("Authentication required");
  }
  return user;
};

/**
 * Require a specific role - throws if not authorized
 */
export const requireRole = async (
  ctx: QueryCtx | MutationCtx,
  userId: Id<"adminUsers"> | undefined,
  requiredRole: AdminRole
) => {
  const user = await requireAuth(ctx, userId);

  if (requiredRole === "superadmin" && user.role !== "superadmin") {
    throw new AuthError("Super admin access required");
  }

  return user;
};

/**
 * Check if user has a specific role
 */
export const hasRole = (
  user: { role: AdminRole },
  requiredRole: AdminRole
): boolean => {
  if (requiredRole === "admin") {
    return true; // Both superadmin and admin have admin access
  }
  return user.role === requiredRole;
};

// ============================================
// SERVER-TO-SERVER SECRET
// ============================================

/**
 * Generic message for every secret failure (missing env var, missing arg,
 * wrong value). It never says which one happened.
 */
const SERVER_SECRET_ERROR = "no autorizado";

const sha256 = async (value: string): Promise<Uint8Array> =>
  new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  );

/**
 * Gate for public mutations that return a raw token meant to be mailed by a
 * Next.js server action. Only a caller holding SERVER_ACTION_SECRET (set in the
 * Convex deployment and in the server-only env of the apps) gets past it.
 *
 * Constant-time: both sides are hashed to 32 bytes first, so the comparison
 * never short-circuits on length or on the first differing byte. Web Crypto
 * only, because the callers run in the V8 runtime (no node:crypto there).
 */
export const requireServerSecret = async (provided: unknown): Promise<void> => {
  const expected = process.env.SERVER_ACTION_SECRET;
  const [a, b] = await Promise.all([
    sha256(typeof provided === "string" ? provided : ""),
    sha256(expected ?? ""),
  ]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  if (!expected || typeof provided !== "string" || diff !== 0) {
    throw new AuthError(SERVER_SECRET_ERROR);
  }
};
