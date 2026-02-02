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
