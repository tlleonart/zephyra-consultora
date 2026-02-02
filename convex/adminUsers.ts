import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireAuth, requireRole, AuthError } from "./model/auth";

// Simple password hashing (in production, use bcrypt via a Convex action)
const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "zephyra-salt-2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
};

const verifyPassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
};

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
    const { passwordHash, ...safeUser } = user;
    return safeUser;
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
    return users.map(({ passwordHash, ...user }) => user);
  },
});

export const getById = query({
  args: { userId: v.id("adminUsers"), targetId: v.id("adminUsers") },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.userId, "superadmin");

    const user = await ctx.db.get(args.targetId);
    if (!user || user.deletedAt) return null;

    const { passwordHash, ...safeUser } = user;
    return safeUser;
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

    const isValid = await verifyPassword(args.password, user.passwordHash);
    if (!isValid) {
      throw new AuthError("Credenciales inválidas");
    }

    // Update last login
    await ctx.db.patch(user._id, { lastLoginAt: Date.now() });

    const { passwordHash, ...safeUser } = user;
    return safeUser;
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

    // Create new token (raw token returned, hash stored)
    const rawToken = crypto.randomUUID();
    const tokenHash = await hashPassword(rawToken);

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

    const tokenHash = await hashPassword(args.token);

    const tokenRecord = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_token", (q) => q.eq("tokenHash", tokenHash))
      .first();

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

    // Update password
    const newPasswordHash = await hashPassword(args.newPassword);
    await ctx.db.patch(user._id, { passwordHash: newPasswordHash });

    // Mark token as used
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

    const passwordHash = await hashPassword("changeme123");

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
