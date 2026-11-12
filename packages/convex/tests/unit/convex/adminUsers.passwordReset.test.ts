/**
 * Unit tests for adminUsers.requestPasswordReset / resetPassword.
 *
 * Why these cases:
 *  - The mutation is public and returns a raw reset token, so it must refuse
 *    every caller that does not hold SERVER_ACTION_SECRET (missing arg, wrong
 *    value, env var unset in Convex), with one generic error.
 *  - The reply carries only what the email needs: no userId.
 *  - At most 3 requests per admin per hour. The 4th mints nothing and replies
 *    exactly like an unknown email does (anti-enumeration).
 *  - Earlier links stop working when a new one is issued (they used to be
 *    deleted; now they are expired so they still count toward the limit).
 *
 * Same `_handler` seam + in-memory ctx pattern as tests/unit/convex/lms/*.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  requestPasswordReset,
  resetPassword,
} from "../../../convex/adminUsers";

/* eslint-disable @typescript-eslint/no-explicit-any */
const rawRequestHandler = (requestPasswordReset as any)._handler as (
  ctx: unknown,
  args: unknown
) => Promise<Record<string, unknown>>;
const resetHandler = (resetPassword as any)._handler as (
  ctx: unknown,
  args: unknown
) => Promise<{ success: boolean }>;
/* eslint-enable @typescript-eslint/no-explicit-any */

const TEST_SERVER_SECRET = process.env.SERVER_ACTION_SECRET as string;
const requestHandler = (ctx: unknown, args: Record<string, unknown>) =>
  rawRequestHandler(ctx, { serverSecret: TEST_SERVER_SECRET, ...args });

interface MockAdmin {
  _id: string;
  email: string;
  name: string;
  role: "superadmin" | "admin";
  isActive: boolean;
  passwordHash?: string;
  deletedAt?: number;
}

interface MockResetToken {
  _id: string;
  _creationTime: number;
  adminUserId: string;
  tokenHash: string;
  expiresAt: number;
  usedAt?: number;
}

const ADMIN: MockAdmin = {
  _id: "admin-1",
  email: "admin@zephyra.test",
  name: "Admin",
  role: "admin",
  isActive: true,
  passwordHash: "old-hash",
};

const buildCtx = (init: { admins?: MockAdmin[]; tokens?: MockResetToken[] }) => {
  const admins = (init.admins ?? [ADMIN]).map((a) => ({ ...a }));
  const tokens = (init.tokens ?? []).map((t) => ({ ...t }));
  let idCounter = 0;

  const tableRows = (table: string): Array<Record<string, unknown>> => {
    if (table === "adminUsers") return admins as unknown as Array<Record<string, unknown>>;
    if (table === "passwordResetTokens")
      return tokens as unknown as Array<Record<string, unknown>>;
    throw new Error(`unexpected table ${table}`);
  };

  const db = {
    get: vi.fn(async (id: string) => {
      return (
        admins.find((a) => a._id === id) ?? tokens.find((t) => t._id === id) ?? null
      );
    }),
    query: vi.fn((table: string) => {
      let predicates: Array<{ field: string; value: unknown }> = [];
      const matches = () =>
        tableRows(table).filter((row) =>
          predicates.every((p) => row[p.field] === p.value)
        );
      const stub = {
        withIndex: (
          _name: string,
          builder: (q: { eq: (f: string, v: unknown) => unknown }) => unknown
        ) => {
          predicates = [];
          const q = {
            eq: (field: string, value: unknown) => {
              predicates.push({ field, value });
              return q;
            },
          };
          builder(q);
          return stub;
        },
        first: async () => matches()[0] ?? null,
        collect: async () => matches(),
      };
      return stub;
    }),
    insert: vi.fn(async (table: string, row: Record<string, unknown>) => {
      if (table !== "passwordResetTokens") throw new Error(`unexpected insert ${table}`);
      const _id = `reset-${++idCounter}`;
      tokens.push({ _id, _creationTime: Date.now(), ...(row as Omit<MockResetToken, "_id" | "_creationTime">) });
      return _id;
    }),
    patch: vi.fn(async (id: string, patch: Record<string, unknown>) => {
      const row = admins.find((a) => a._id === id) ?? tokens.find((t) => t._id === id);
      if (row) Object.assign(row, patch);
    }),
    delete: vi.fn(async (id: string) => {
      const i = tokens.findIndex((t) => t._id === id);
      if (i >= 0) tokens.splice(i, 1);
    }),
  };

  return { ctx: { db }, admins, tokens };
};

beforeEach(() => vi.clearAllMocks());

describe("requestPasswordReset — server secret (CA-1)", () => {
  it("rejects a call without serverSecret and mints nothing", async () => {
    const { ctx, tokens } = buildCtx({});
    await expect(
      rawRequestHandler(ctx, { email: ADMIN.email })
    ).rejects.toThrow(/^no autorizado$/);
    expect(tokens).toHaveLength(0);
  });

  it("rejects a wrong serverSecret with the same generic error", async () => {
    const { ctx, tokens } = buildCtx({});
    await expect(
      requestHandler(ctx, { email: ADMIN.email, serverSecret: "wrong" })
    ).rejects.toThrow(/^no autorizado$/);
    expect(tokens).toHaveLength(0);
  });

  it("rejects when SERVER_ACTION_SECRET is unset in Convex", async () => {
    const saved = process.env.SERVER_ACTION_SECRET;
    delete process.env.SERVER_ACTION_SECRET;
    try {
      const { ctx, tokens } = buildCtx({});
      await expect(
        requestHandler(ctx, { email: ADMIN.email })
      ).rejects.toThrow(/^no autorizado$/);
      expect(tokens).toHaveLength(0);
    } finally {
      process.env.SERVER_ACTION_SECRET = saved;
    }
  });
});

describe("requestPasswordReset — reply and flow (CA-2, CA-3)", () => {
  it("returns only token, userName and userEmail (no userId)", async () => {
    const { ctx } = buildCtx({});
    const res = await requestHandler(ctx, { email: "  Admin@Zephyra.TEST " });
    expect(Object.keys(res).sort()).toEqual(
      ["success", "token", "userEmail", "userName"].sort()
    );
    expect(res).not.toHaveProperty("userId");
    expect(res.userEmail).toBe(ADMIN.email);
    expect(res.userName).toBe(ADMIN.name);
  });

  it("the returned token resets the password", async () => {
    const { ctx, admins, tokens } = buildCtx({});
    const res = await requestHandler(ctx, { email: ADMIN.email });
    const out = await resetHandler(ctx, {
      token: res.token,
      newPassword: "nueva-clave-123",
    });
    expect(out.success).toBe(true);
    expect(admins[0].passwordHash).not.toBe("old-hash");
    expect(tokens[0].usedAt).toBeTypeOf("number");
  });

  it("an unknown email replies { success: true } and mints nothing", async () => {
    const { ctx, tokens } = buildCtx({});
    const res = await requestHandler(ctx, { email: "ghost@zephyra.test" });
    expect(res).toEqual({ success: true });
    expect(tokens).toHaveLength(0);
  });

  it("a new link supersedes the previous one", async () => {
    const { ctx } = buildCtx({});
    const first = await requestHandler(ctx, { email: ADMIN.email });
    await requestHandler(ctx, { email: ADMIN.email });
    await expect(
      resetHandler(ctx, { token: first.token, newPassword: "nueva-clave-123" })
    ).rejects.toThrow(/expirado/);
  });
});

describe("requestPasswordReset — 3 per admin per hour (CA-4)", () => {
  it("the fourth request mints nothing and replies like an unknown email", async () => {
    const { ctx, tokens } = buildCtx({});
    for (let i = 0; i < 3; i++) {
      const ok = await requestHandler(ctx, { email: ADMIN.email });
      expect(ok.token).toBeTypeOf("string");
    }
    expect(tokens).toHaveLength(3);

    const fourth = await requestHandler(ctx, { email: ADMIN.email });
    const unknown = await requestHandler(ctx, { email: "ghost@zephyra.test" });
    expect(fourth).toEqual({ success: true });
    expect(fourth).toEqual(unknown);
    expect(tokens).toHaveLength(3);
  });

  it("the last link issued before the limit still works", async () => {
    const { ctx } = buildCtx({});
    await requestHandler(ctx, { email: ADMIN.email });
    await requestHandler(ctx, { email: ADMIN.email });
    const third = await requestHandler(ctx, { email: ADMIN.email });
    await requestHandler(ctx, { email: ADMIN.email }); // limited
    const out = await resetHandler(ctx, {
      token: third.token,
      newPassword: "nueva-clave-123",
    });
    expect(out.success).toBe(true);
  });

  it("rows older than one hour do not count and are cleaned up", async () => {
    const now = Date.now();
    const old = (id: string): MockResetToken => ({
      _id: id,
      _creationTime: now - 61 * 60 * 1000,
      adminUserId: ADMIN._id,
      tokenHash: id,
      expiresAt: now - 60 * 1000,
    });
    const { ctx, tokens } = buildCtx({ tokens: [old("o1"), old("o2"), old("o3")] });
    const res = await requestHandler(ctx, { email: ADMIN.email });
    expect(res.token).toBeTypeOf("string");
    expect(tokens).toHaveLength(1);
    expect(tokens[0]._id).not.toMatch(/^o/);
  });
});
