import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { requireRole, AuthError } from "./model/auth";
import {
  hashPassword,
  verifyPassword,
  hashOpaqueToken,
  verifyOpaqueToken,
} from "./model/passwords";

// Strip the password hash before returning an adminUsers document to clients.
// Centralised so the type stays consistent across queries/mutations.
function stripPasswordHash(user: Doc<"adminUsers">): Omit<Doc<"adminUsers">, "passwordHash"> {
  const safe: Omit<Doc<"adminUsers">, "passwordHash"> & { passwordHash?: string } = { ...user };
  delete safe.passwordHash;
  return safe;
}

// ============================================
// QUERIES
// ============================================

export const getCurrentUser = query({
  args: { userId: v.optional(v.id("adminUsers")) },
  handler: async (ctx, args) => {
    if (!args.userId) return null;

    const user = await ctx.db.get(args.userId);
    if (!user || user.deletedAt || !user.isActive) {
      return null;
    }

    // Don't return password hash
    return stripPasswordHash(user);
  },
});

export const list = query({
  args: { userId: v.id("adminUsers") },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.userId, "superadmin");

    const users = await ctx.db
      .query("adminUsers")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // Don't return password hashes
    return users.map(stripPasswordHash);
  },
});

export const getById = query({
  args: { userId: v.id("adminUsers"), targetId: v.id("adminUsers") },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.userId, "superadmin");

    const user = await ctx.db.get(args.targetId);
    if (!user || user.deletedAt) return null;

    return stripPasswordHash(user);
  },
});

// ============================================
// MUTATIONS
// ============================================

export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("adminUsers")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();

    if (!user || user.deletedAt || !user.isActive) {
      throw new AuthError("Credenciales inválidas");
    }

    const result = await verifyPassword(args.password, user.passwordHash);
    if (!result.valid) {
      throw new AuthError("Credenciales inválidas");
    }

    // Lazy migration: legacy SHA-256 rows get rehashed to argon2id transparently.
    const patch: { lastLoginAt: number; passwordHash?: string } = {
      lastLoginAt: Date.now(),
    };
    if (result.needsRehash) {
      patch.passwordHash = await hashPassword(args.password);
    }
    await ctx.db.patch(user._id, patch);

    return stripPasswordHash(user);
  },
});

export const create = mutation({
  args: {
    userId: v.id("adminUsers"),
    email: v.string(),
    name: v.string(),
    password: v.string(),
    role: v.union(v.literal("superadmin"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.userId, "superadmin");

    const email = args.email.toLowerCase().trim();

    // Check if email already exists
    const existing = await ctx.db
      .query("adminUsers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existing) {
      throw new Error("Ya existe un usuario con este email");
    }

    // Validate password
    if (args.password.length < 8) {
      throw new Error("La contraseña debe tener al menos 8 caracteres");
    }

    const passwordHash = await hashPassword(args.password);

    const id = await ctx.db.insert("adminUsers", {
      email,
      name: args.name.trim(),
      passwordHash,
      role: args.role,
      isActive: true,
      createdAt: Date.now(),
    });

    return id;
  },
});

export const update = mutation({
  args: {
    userId: v.id("adminUsers"),
    targetId: v.id("adminUsers"),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    password: v.optional(v.string()),
    role: v.optional(v.union(v.literal("superadmin"), v.literal("admin"))),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.userId, "superadmin");

    const user = await ctx.db.get(args.targetId);
    if (!user || user.deletedAt) {
      throw new Error("Usuario no encontrado");
    }

    // Prevent superadmin from demoting themselves
    if (
      args.userId === args.targetId &&
      args.role &&
      args.role !== "superadmin"
    ) {
      throw new Error("No puedes cambiar tu propio rol");
    }

    const updates: Partial<typeof user> = {};

    if (args.email) {
      const email = args.email.toLowerCase().trim();
      if (email !== user.email) {
        const existing = await ctx.db
          .query("adminUsers")
          .withIndex("by_email", (q) => q.eq("email", email))
          .first();
        if (existing) {
          throw new Error("Ya existe un usuario con este email");
        }
        updates.email = email;
      }
    }

    if (args.name) updates.name = args.name.trim();
    if (args.role) updates.role = args.role;
    if (args.isActive !== undefined) updates.isActive = args.isActive;

    if (args.password) {
      if (args.password.length < 8) {
        throw new Error("La contraseña debe tener al menos 8 caracteres");
      }
      updates.passwordHash = await hashPassword(args.password);
    }

    await ctx.db.patch(args.targetId, updates);
  },
});

export const remove = mutation({
  args: {
    userId: v.id("adminUsers"),
    targetId: v.id("adminUsers"),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.userId, "superadmin");

    // Prevent deleting yourself
    if (args.userId === args.targetId) {
      throw new Error("No puedes eliminarte a ti mismo");
    }

    const user = await ctx.db.get(args.targetId);
    if (!user || user.deletedAt) {
      throw new Error("Usuario no encontrado");
    }

    await ctx.db.patch(args.targetId, {
      deletedAt: Date.now(),
      deletedBy: args.userId,
    });
  },
});

// ============================================
// PASSWORD RESET
// ============================================

export const requestPasswordReset = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();
    const user = await ctx.db
      .query("adminUsers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    // Always return success to prevent email enumeration
    if (!user || user.deletedAt || !user.isActive) {
      return { success: true };
    }

    // Delete any existing tokens for this user
    const existingTokens = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_user", (q) => q.eq("adminUserId", user._id))
      .collect();

    for (const token of existingTokens) {
      await ctx.db.delete(token._id);
    }

    // HMAC-SHA-256 of the random opaque token (Q6 lock — argon2 is the wrong
    // tool for opaque random tokens).
    const rawToken = crypto.randomUUID();
    const tokenHash = await hashOpaqueToken(rawToken);

    await ctx.db.insert("passwordResetTokens", {
      adminUserId: user._id,
      tokenHash,
      expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    // Return token and user info for email sending (done via server action)
    return {
      success: true,
      token: rawToken,
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
    };
  },
});

export const resetPassword = mutation({
  args: {
    token: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.newPassword.length < 8) {
      throw new Error("La contraseña debe tener al menos 8 caracteres");
    }

    // Fast path: lookup by HMAC hash on the by_token index.
    const hmacHash = await hashOpaqueToken(args.token);
    let tokenRecord = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_token", (q) => q.eq("tokenHash", hmacHash))
      .first();

    // Legacy fallback: scan candidate rows by lazy verify if HMAC missed.
    // Tokens are single-use + short-lived, so legacy rows drain quickly.
    let isLegacyToken = false;
    if (!tokenRecord) {
      const candidates = await ctx.db.query("passwordResetTokens").collect();
      for (const candidate of candidates) {
        const verdict = await verifyOpaqueToken(args.token, candidate.tokenHash);
        if (verdict.valid) {
          tokenRecord = candidate;
          isLegacyToken = verdict.isLegacy;
          break;
        }
      }
    }

    if (!tokenRecord) {
      throw new Error("Token inválido o expirado");
    }

    if (tokenRecord.usedAt) {
      throw new Error("Este enlace ya fue utilizado");
    }

    if (tokenRecord.expiresAt < Date.now()) {
      throw new Error("El enlace ha expirado");
    }

    const user = await ctx.db.get(tokenRecord.adminUserId);
    if (!user || user.deletedAt || !user.isActive) {
      throw new Error("Usuario no encontrado");
    }

    // Update password to argon2id.
    const newPasswordHash = await hashPassword(args.newPassword);
    await ctx.db.patch(user._id, { passwordHash: newPasswordHash });

    // Mark token as used. Legacy token rows are single-use so we do not
    // bother re-hashing them to HMAC; usedAt closes the row.
    void isLegacyToken;
    await ctx.db.patch(tokenRecord._id, { usedAt: Date.now() });

    return { success: true };
  },
});

// ============================================
// SEED (internal mutation)
// ============================================

export const seedSuperAdmin = internalMutation({
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("adminUsers")
      .withIndex("by_email", (q) =>
        q.eq("email", "admin@zephyraconsultora.com")
      )
      .first();

    if (existing) {
      console.log("Super admin already exists");
      return;
    }

    // Dev-only bootstrap. The default password MUST come from env so no
    // shared literal lives in the repo. Operators set DEV_ADMIN_DEFAULT_PASSWORD
    // in .env.local (gitignored) before running this internal mutation.
    const seedPassword = process.env.DEV_ADMIN_DEFAULT_PASSWORD;
    if (!seedPassword) {
      throw new Error(
        "DEV_ADMIN_DEFAULT_PASSWORD is not set; refusing to seed super admin with a known literal."
      );
    }
    const passwordHash = await hashPassword(seedPassword);

    await ctx.db.insert("adminUsers", {
      email: "admin@zephyraconsultora.com",
      name: "Super Admin",
      passwordHash,
      role: "superadmin",
      isActive: true,
      createdAt: Date.now(),
    });

    console.log("Super admin created successfully");
  },
});
