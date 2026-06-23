/**
 * Unit tests for convex/lms/auth.ts (learner auth backend).
 *
 * Why these specific cases:
 *  - requestMagicLink mints a fresh HMAC token + applies the right TTL per
 *    purpose. Activation is the only path that may pre-empt with
 *    `alreadyActivated: true`; sign-in / recovery throw on no-customer.
 *  - consumeMagicLink is the SECURITY surface: expiry + single-use +
 *    purpose-match. The cross-purpose escalation guard is the regression
 *    fence against an activation token being accepted as a sign-in.
 *  - setLearnerPassword enforces min 8 chars + non-alphanumeric. Reject
 *    paths must throw clear errors, not silently succeed.
 *  - signInLearnerWithPassword collapses every failure mode to the same
 *    "credenciales inválidas" string (anti-enumeration). The four reject
 *    paths are covered individually.
 *  - getLearnerById strips `passwordHash` from the returned payload so the
 *    cookie minter never sees it.
 *
 *  Uses the B04 `_handler` seam pattern (Convex public function objects
 *  expose the raw handler under `_handler` for direct unit invocation,
 *  bypassing the framework's runtime arg validation).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  requestMagicLink,
  consumeMagicLink,
  setLearnerPassword,
  signInLearnerWithPassword,
  getLearnerById,
} from "../../../../convex/lms/auth";
import { AuthError } from "../../../../convex/model/auth";
import { hashOpaqueToken } from "../../../../convex/model/passwords";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const requestHandler = (requestMagicLink as any)._handler as (
  ctx: unknown,
  args: unknown
) => Promise<{
  rawToken: string | null;
  expiresAt: number | null;
  alreadyActivated: boolean;
}>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const consumeHandler = (consumeMagicLink as any)._handler as (
  ctx: unknown,
  args: unknown
) => Promise<{ customer: Record<string, unknown> }>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const setPasswordHandler = (setLearnerPassword as any)._handler as (
  ctx: unknown,
  args: unknown
) => Promise<{ ok: true }>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const signInHandler = (signInLearnerWithPassword as any)._handler as (
  ctx: unknown,
  args: unknown
) => Promise<{ customer: Record<string, unknown> }>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getByIdHandler = (getLearnerById as any)._handler as (
  ctx: unknown,
  args: unknown
) => Promise<Record<string, unknown> | null>;

// ------------------------------------------------------------
// Mock DB
// ------------------------------------------------------------

interface MockCustomer {
  _id: string;
  email: string;
  type: "individual" | "org_admin" | "org_learner";
  passwordHash?: string;
  organizationId?: string;
  activatedAt?: number;
  lastLoginAt?: number;
  createdAt: number;
  deletedAt?: number;
}

interface MockToken {
  _id: string;
  email: string;
  tokenHash: string;
  purpose: "learner_activation" | "learner_signin" | "learner_recovery";
  expiresAt: number;
  usedAt?: number;
  createdAt: number;
  createdFromIp?: string;
}

const buildCtx = (init: {
  customers?: MockCustomer[];
  tokens?: MockToken[];
}) => {
  const customers: MockCustomer[] = init.customers
    ? init.customers.map((c) => ({ ...c }))
    : [];
  const tokens: MockToken[] = init.tokens
    ? init.tokens.map((t) => ({ ...t }))
    : [];

  let idCounter = 100;
  const nextId = (prefix: string) => `${prefix}-${++idCounter}`;

  // Build a withIndex-style stub that filters the appropriate collection.
  const buildIndexedQuery = <T>(
    rows: T[],
    matcher: (eq: (field: string, value: unknown) => unknown) => unknown,
    fieldsOf: (row: T) => Record<string, unknown>
  ) => {
    // Capture the eq predicates that the handler sets via the q.eq chain.
    const predicates: Array<{ field: string; value: unknown }> = [];
    const q = {
      eq: (field: string, value: unknown) => {
        predicates.push({ field, value });
        return q;
      },
    };
    matcher(q.eq);
    return {
      first: async (): Promise<T | null> => {
        const found = rows.find((row) => {
          const r = fieldsOf(row);
          return predicates.every((p) => r[p.field] === p.value);
        });
        return found ?? null;
      },
      collect: async (): Promise<T[]> => {
        return rows.filter((row) => {
          const r = fieldsOf(row);
          return predicates.every((p) => r[p.field] === p.value);
        });
      },
    };
  };

  const db = {
    get: vi.fn(async (id: string) => {
      const c = customers.find((x) => x._id === id);
      if (c) return c;
      const t = tokens.find((x) => x._id === id);
      if (t) return t;
      return null;
    }),
    query: vi.fn((table: string) => {
      let pendingPredicates: Array<{ field: string; value: unknown }> = [];
      const queryStub = {
        withIndex: (
          _name: string,
          builder: (q: { eq: (f: string, v: unknown) => unknown }) => unknown
        ) => {
          pendingPredicates = [];
          const q = {
            eq: (field: string, value: unknown) => {
              pendingPredicates.push({ field, value });
              return q;
            },
          };
          builder(q);
          return queryStub;
        },
        first: async () => {
          if (table === "lmsCustomers") {
            return (
              customers.find((c) =>
                pendingPredicates.every(
                  (p) => (c as unknown as Record<string, unknown>)[p.field] === p.value
                )
              ) ?? null
            );
          }
          if (table === "lmsMagicLinkTokens") {
            return (
              tokens.find((t) =>
                pendingPredicates.every(
                  (p) => (t as unknown as Record<string, unknown>)[p.field] === p.value
                )
              ) ?? null
            );
          }
          return null;
        },
        collect: async () => {
          if (table === "lmsCustomers") {
            return customers.filter((c) =>
              pendingPredicates.every(
                (p) => (c as unknown as Record<string, unknown>)[p.field] === p.value
              )
            );
          }
          if (table === "lmsMagicLinkTokens") {
            return tokens.filter((t) =>
              pendingPredicates.every(
                (p) => (t as unknown as Record<string, unknown>)[p.field] === p.value
              )
            );
          }
          return [];
        },
      };
      void buildIndexedQuery;
      return queryStub;
    }),
    insert: vi.fn(async (table: string, row: Record<string, unknown>) => {
      if (table === "lmsCustomers") {
        const _id = nextId("cust");
        customers.push({ _id, ...(row as Omit<MockCustomer, "_id">) });
        return _id;
      }
      if (table === "lmsMagicLinkTokens") {
        const _id = nextId("tok");
        tokens.push({ _id, ...(row as Omit<MockToken, "_id">) });
        return _id;
      }
      throw new Error(`unexpected insert into ${table}`);
    }),
    patch: vi.fn(async (id: string, patch: Record<string, unknown>) => {
      const c = customers.find((x) => x._id === id);
      if (c) {
        Object.assign(c, patch);
        return;
      }
      const t = tokens.find((x) => x._id === id);
      if (t) {
        Object.assign(t, patch);
        return;
      }
    }),
  };

  return { ctx: { db }, db, customers, tokens };
};

beforeEach(() => vi.clearAllMocks());

// ============================================================================
// requestMagicLink
// ============================================================================

describe("requestMagicLink", () => {
  it("activation happy path mints a fresh token + 30min TTL", async () => {
    const { ctx, tokens } = buildCtx({});
    const before = Date.now();
    const result = await requestHandler(ctx, {
      email: "Learner@Example.COM",
      purpose: "learner_activation",
    });
    expect(result.alreadyActivated).toBe(false);
    expect(typeof result.rawToken).toBe("string");
    expect((result.rawToken as string).length).toBe(64); // 32 bytes hex
    expect(result.expiresAt).not.toBeNull();
    expect((result.expiresAt as number) - before).toBeGreaterThanOrEqual(
      30 * 60 * 1000 - 100
    );
    expect((result.expiresAt as number) - before).toBeLessThanOrEqual(
      30 * 60 * 1000 + 1000
    );
    expect(tokens).toHaveLength(1);
    expect(tokens[0].email).toBe("learner@example.com");
    expect(tokens[0].purpose).toBe("learner_activation");
    // HMAC hash should match what hashOpaqueToken produces.
    const expectedHash = await hashOpaqueToken(result.rawToken as string);
    expect(tokens[0].tokenHash).toBe(expectedHash);
  });

  it("signin happy path uses the 15min TTL", async () => {
    const customer: MockCustomer = {
      _id: "cust-1",
      email: "x@y.com",
      type: "individual",
      createdAt: 1,
      activatedAt: 2,
    };
    const { ctx, tokens } = buildCtx({ customers: [customer] });
    const before = Date.now();
    const result = await requestHandler(ctx, {
      email: "x@y.com",
      purpose: "learner_signin",
    });
    expect(result.alreadyActivated).toBe(false);
    expect((result.expiresAt as number) - before).toBeLessThanOrEqual(
      15 * 60 * 1000 + 1000
    );
    expect((result.expiresAt as number) - before).toBeGreaterThanOrEqual(
      15 * 60 * 1000 - 100
    );
    expect(tokens).toHaveLength(1);
    expect(tokens[0].purpose).toBe("learner_signin");
  });

  it("activation with already-activated customer returns alreadyActivated:true without minting", async () => {
    const customer: MockCustomer = {
      _id: "cust-2",
      email: "act@y.com",
      type: "individual",
      createdAt: 1,
      activatedAt: 2,
    };
    const { ctx, tokens } = buildCtx({ customers: [customer] });
    const result = await requestHandler(ctx, {
      email: "act@y.com",
      purpose: "learner_activation",
    });
    expect(result.alreadyActivated).toBe(true);
    expect(result.rawToken).toBeNull();
    expect(result.expiresAt).toBeNull();
    expect(tokens).toHaveLength(0);
  });

  it("signin with no customer throws", async () => {
    const { ctx } = buildCtx({});
    await expect(
      requestHandler(ctx, {
        email: "ghost@y.com",
        purpose: "learner_signin",
      })
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("recovery with no customer throws", async () => {
    const { ctx } = buildCtx({});
    await expect(
      requestHandler(ctx, {
        email: "ghost@y.com",
        purpose: "learner_recovery",
      })
    ).rejects.toBeInstanceOf(AuthError);
  });
});

// ============================================================================
// consumeMagicLink
// ============================================================================

describe("consumeMagicLink", () => {
  it("activation happy path creates the lmsCustomers row", async () => {
    const rawToken = "a".repeat(64);
    const tokenHash = await hashOpaqueToken(rawToken);
    const token: MockToken = {
      _id: "tok-1",
      email: "new@y.com",
      tokenHash,
      purpose: "learner_activation",
      expiresAt: Date.now() + 60_000,
      createdAt: Date.now(),
    };
    const { ctx, customers, tokens } = buildCtx({ tokens: [token] });
    const result = await consumeHandler(ctx, {
      token: rawToken,
      purpose: "learner_activation",
    });
    expect(result.customer.email).toBe("new@y.com");
    expect(result.customer.type).toBe("individual");
    expect(result.customer.activatedAt).toBeTypeOf("number");
    expect(customers).toHaveLength(1);
    expect(tokens[0].usedAt).toBeTypeOf("number");
  });

  it("signin happy path returns the customer + stamps lastLoginAt", async () => {
    const rawToken = "b".repeat(64);
    const tokenHash = await hashOpaqueToken(rawToken);
    const customer: MockCustomer = {
      _id: "cust-10",
      email: "si@y.com",
      type: "individual",
      createdAt: 1,
      activatedAt: 2,
    };
    const token: MockToken = {
      _id: "tok-2",
      email: "si@y.com",
      tokenHash,
      purpose: "learner_signin",
      expiresAt: Date.now() + 60_000,
      createdAt: Date.now(),
    };
    const { ctx, customers } = buildCtx({
      customers: [customer],
      tokens: [token],
    });
    const result = await consumeHandler(ctx, {
      token: rawToken,
      purpose: "learner_signin",
    });
    expect(result.customer._id).toBe("cust-10");
    expect(customers[0].lastLoginAt).toBeTypeOf("number");
  });

  it("expired token throws", async () => {
    const rawToken = "c".repeat(64);
    const tokenHash = await hashOpaqueToken(rawToken);
    const token: MockToken = {
      _id: "tok-3",
      email: "z@y.com",
      tokenHash,
      purpose: "learner_activation",
      expiresAt: Date.now() - 1, // expired
      createdAt: Date.now() - 1000,
    };
    const { ctx } = buildCtx({ tokens: [token] });
    await expect(
      consumeHandler(ctx, {
        token: rawToken,
        purpose: "learner_activation",
      })
    ).rejects.toThrow(/expirado/);
  });

  it("already used token throws", async () => {
    const rawToken = "d".repeat(64);
    const tokenHash = await hashOpaqueToken(rawToken);
    const token: MockToken = {
      _id: "tok-4",
      email: "z@y.com",
      tokenHash,
      purpose: "learner_activation",
      expiresAt: Date.now() + 60_000,
      usedAt: Date.now() - 100,
      createdAt: Date.now() - 200,
    };
    const { ctx } = buildCtx({ tokens: [token] });
    await expect(
      consumeHandler(ctx, {
        token: rawToken,
        purpose: "learner_activation",
      })
    ).rejects.toThrow(/ya fue usado/);
  });

  it("cross-purpose escalation guard: activation token rejected on signin path", async () => {
    const rawToken = "e".repeat(64);
    const tokenHash = await hashOpaqueToken(rawToken);
    const token: MockToken = {
      _id: "tok-5",
      email: "z@y.com",
      tokenHash,
      purpose: "learner_activation",
      expiresAt: Date.now() + 60_000,
      createdAt: Date.now(),
    };
    const { ctx } = buildCtx({ tokens: [token] });
    await expect(
      consumeHandler(ctx, {
        token: rawToken,
        purpose: "learner_signin",
      })
    ).rejects.toThrow(/inválido para esta operación/);
  });

  it("unknown token throws", async () => {
    const { ctx } = buildCtx({});
    await expect(
      consumeHandler(ctx, {
        token: "ffff",
        purpose: "learner_activation",
      })
    ).rejects.toThrow(/inválido o expirado/);
  });

  it("SEAT-INVITE GUARD: a seat_invite token is REJECTED by consumeMagicLink (must not mint a B2C session)", async () => {
    const rawToken = "f".repeat(64);
    const tokenHash = await hashOpaqueToken(rawToken);
    // A B2B seat_invite token (claimed only by lms/seats.ts:claimSeat). The
    // MockToken.purpose union is B2C-only, so cast to seed the cross-purpose row.
    const token = {
      _id: "tok-seat",
      email: "emp@acme.com",
      tokenHash,
      purpose: "seat_invite",
      expiresAt: Date.now() + 60_000,
      createdAt: Date.now(),
    } as unknown as MockToken;
    const { ctx, customers } = buildCtx({ tokens: [token] });
    await expect(
      consumeHandler(ctx, {
        token: rawToken,
        // Even claiming it as activation must fail — the row is seat_invite.
        purpose: "learner_activation",
      })
    ).rejects.toThrow(/inválido para esta operación/);
    // No B2C customer minted.
    expect(customers).toHaveLength(0);
  });
});

// ============================================================================
// setLearnerPassword
// ============================================================================

describe("setLearnerPassword", () => {
  it("happy path hashes + patches the customer row", async () => {
    const customer: MockCustomer = {
      _id: "cust-20",
      email: "pw@y.com",
      type: "individual",
      createdAt: 1,
      activatedAt: 2,
    };
    const { ctx, customers } = buildCtx({ customers: [customer] });
    const result = await setPasswordHandler(ctx, {
      learnerId: "cust-20",
      password: "StrongPass!1",
    });
    expect(result.ok).toBe(true);
    expect(customers[0].passwordHash).toBeDefined();
    expect(customers[0].passwordHash!.startsWith("$argon2id$")).toBe(true);
  });

  it("rejects weak password (no non-alphanumeric)", async () => {
    const customer: MockCustomer = {
      _id: "cust-21",
      email: "pw2@y.com",
      type: "individual",
      createdAt: 1,
    };
    const { ctx } = buildCtx({ customers: [customer] });
    await expect(
      setPasswordHandler(ctx, {
        learnerId: "cust-21",
        password: "AllLetters1",
      })
    ).rejects.toThrow(/no alfanumérico/);
  });

  it("rejects password shorter than 8 chars", async () => {
    const customer: MockCustomer = {
      _id: "cust-22",
      email: "pw3@y.com",
      type: "individual",
      createdAt: 1,
    };
    const { ctx } = buildCtx({ customers: [customer] });
    await expect(
      setPasswordHandler(ctx, {
        learnerId: "cust-22",
        password: "a!1",
      })
    ).rejects.toThrow(/8 caracteres/);
  });

  it("rejects non-existent learner", async () => {
    const { ctx } = buildCtx({});
    await expect(
      setPasswordHandler(ctx, {
        learnerId: "ghost",
        password: "StrongPass!1",
      })
    ).rejects.toThrow(/learner no encontrado/);
  });
});

// ============================================================================
// signInLearnerWithPassword
// ============================================================================

describe("signInLearnerWithPassword", () => {
  // Build a customer with a real argon2id hash via setLearnerPassword first.
  const seedCustomerWithPassword = async (
    email: string,
    password: string
  ) => {
    // First, hash the password using the production helper so verifyPassword
    // is exercised end-to-end in the test.
    const { hashPassword } = await import(
      "../../../../convex/model/passwords"
    );
    const hash = await hashPassword(password);
    return {
      _id: "cust-pw",
      email,
      type: "individual" as const,
      passwordHash: hash,
      createdAt: 1,
      activatedAt: 2,
    };
  };

  it("happy path returns customer + stamps lastLoginAt", async () => {
    const customer = await seedCustomerWithPassword("si@y.com", "StrongPass!1");
    const { ctx, customers } = buildCtx({ customers: [customer] });
    const result = await signInHandler(ctx, {
      email: "si@y.com",
      password: "StrongPass!1",
    });
    expect(result.customer._id).toBe("cust-pw");
    expect(customers[0].lastLoginAt).toBeTypeOf("number");
  });

  it("wrong password throws uniform credenciales inválidas", async () => {
    const customer = await seedCustomerWithPassword("si@y.com", "StrongPass!1");
    const { ctx } = buildCtx({ customers: [customer] });
    await expect(
      signInHandler(ctx, { email: "si@y.com", password: "wrong-pw-1" })
    ).rejects.toThrow(/credenciales inválidas/);
  });

  it("non-existent learner throws uniform credenciales inválidas", async () => {
    const { ctx } = buildCtx({});
    await expect(
      signInHandler(ctx, {
        email: "ghost@y.com",
        password: "StrongPass!1",
      })
    ).rejects.toThrow(/credenciales inválidas/);
  });

  it("learner without passwordHash throws uniform credenciales inválidas (anti-enumeration)", async () => {
    const customer: MockCustomer = {
      _id: "cust-nopw",
      email: "nopw@y.com",
      type: "individual",
      createdAt: 1,
      activatedAt: 2,
      // passwordHash intentionally undefined
    };
    const { ctx } = buildCtx({ customers: [customer] });
    await expect(
      signInHandler(ctx, {
        email: "nopw@y.com",
        password: "StrongPass!1",
      })
    ).rejects.toThrow(/credenciales inválidas/);
  });
});

// ============================================================================
// getLearnerById
// ============================================================================

describe("getLearnerById", () => {
  it("returns the row without passwordHash on happy path", async () => {
    const customer: MockCustomer = {
      _id: "cust-30",
      email: "g@y.com",
      type: "individual",
      passwordHash: "$argon2id$secret",
      createdAt: 1,
      activatedAt: 2,
    };
    const { ctx } = buildCtx({ customers: [customer] });
    const result = await getByIdHandler(ctx, { learnerId: "cust-30" });
    expect(result).not.toBeNull();
    expect(result!._id).toBe("cust-30");
    expect("passwordHash" in result!).toBe(false);
  });

  it("returns null for soft-deleted learner", async () => {
    const customer: MockCustomer = {
      _id: "cust-31",
      email: "del@y.com",
      type: "individual",
      createdAt: 1,
      deletedAt: 100,
    };
    const { ctx } = buildCtx({ customers: [customer] });
    const result = await getByIdHandler(ctx, { learnerId: "cust-31" });
    expect(result).toBeNull();
  });
});
