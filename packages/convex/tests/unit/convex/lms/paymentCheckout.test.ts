/**
 * Unit tests for the checkout flow internals (Sprint 2 P1.2).
 *
 * Covers the order helpers (createOrder externalReference patch, getPendingOrder
 * reuse, updateOrderWithMpPreference) and the createCheckout action's
 * orchestration (already-enrolled guard, not-purchasable guard, double-click
 * reuse). Repo convention: pure-handler-with-mock-ctx. The createCheckoutSession
 * MP call is mocked at the adapter boundary (fetch) so no live MP request fires.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */

// --- generated api mock: gives ctx.runQuery/runMutation refs a dispatch name --
vi.mock("../../../../convex/_generated/api", () => ({
  internal: {
    lms: {
      courses: { getCourseForCheckout: { __name: "getCourseForCheckout" } },
      payment: {
        orders: {
          getPendingOrder: { __name: "getPendingOrder" },
          createOrder: { __name: "createOrder" },
          updateOrderWithMpPreference: {
            __name: "updateOrderWithMpPreference",
          },
        },
      },
    },
  },
  api: {
    lms: {
      auth: { getLearnerById: { __name: "getLearnerById" } },
      enrollments: { getMyEnrollment: { __name: "getMyEnrollment" } },
    },
  },
}));

import { createCheckout } from "../../../../convex/lms/payment/checkout";
import {
  createOrder,
  getPendingOrder,
  updateOrderWithMpPreference,
} from "../../../../convex/lms/payment/orders";

const checkoutHandler = (createCheckout as any)._handler as (
  ctx: any,
  args: any
) => Promise<any>;
const createOrderHandler = (createOrder as any)._handler as (
  ctx: any,
  args: any
) => Promise<any>;
const getPendingHandler = (getPendingOrder as any)._handler as (
  ctx: any,
  args: any
) => Promise<any>;
const updatePrefHandler = (updateOrderWithMpPreference as any)._handler as (
  ctx: any,
  args: any
) => Promise<any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

interface Row {
  _id: string;
  [k: string]: unknown;
}

// Minimal in-memory store mirroring paymentProcessing.test.ts.
function makeStore(seed: { orders?: Row[] } = {}) {
  const tables: Record<string, Row[]> = {
    lmsOrders: [...(seed.orders ?? [])],
  };
  let seq = 0;

  const db = {
    get: vi.fn(async (id: string) => {
      for (const t of Object.values(tables)) {
        const found = t.find((r) => r._id === id);
        if (found) return found;
      }
      return null;
    }),
    insert: vi.fn(async (table: string, row: Record<string, unknown>) => {
      seq += 1;
      const _id = `${table}-${seq}`;
      tables[table] = tables[table] ?? [];
      tables[table].push({ _id, ...row });
      return _id;
    }),
    patch: vi.fn(async (id: string, patch: Record<string, unknown>) => {
      for (const t of Object.values(tables)) {
        const found = t.find((r) => r._id === id);
        if (found) Object.assign(found, patch);
      }
    }),
    query: vi.fn((table: string) => {
      const eqs: Array<[string, unknown]> = [];
      const chain = {
        withIndex: (
          _name: string,
          builder: (q: { eq: (f: string, v: unknown) => unknown }) => unknown
        ) => {
          const q = {
            eq: (f: string, v: unknown) => {
              eqs.push([f, v]);
              return q;
            },
          };
          builder(q);
          return chain;
        },
        first: async () => {
          const rows = tables[table] ?? [];
          return rows.find((r) => eqs.every(([f, v]) => r[f] === v)) ?? null;
        },
      };
      return chain;
    }),
  };

  return { db, tables };
}

beforeEach(() => vi.clearAllMocks());

// ============================================================================
// Order helpers
// ============================================================================
describe("createOrder", () => {
  it("inserts a pending order and patches externalReference to its own _id", async () => {
    const { db, tables } = makeStore();
    const ctx = { db };
    const order = await createOrderHandler(ctx, {
      customerId: "lmsCustomers-1",
      courseId: "lmsCourses-1",
      priceUsd: 90,
    });
    expect(order.status).toBe("pending_payment");
    // externalReference == the row's own _id (the webhook's resolve bridge).
    expect(order.externalReference).toBe(order._id);
    expect(tables.lmsOrders).toHaveLength(1);
  });

  it("rejects a non-positive price", async () => {
    const { db } = makeStore();
    await expect(
      createOrderHandler({ db }, {
        customerId: "lmsCustomers-1",
        courseId: "lmsCourses-1",
        priceUsd: 0,
      })
    ).rejects.toThrow(/positive/);
  });
});

describe("getPendingOrder", () => {
  it("returns the pending order for the (customer, course) tuple", async () => {
    const { db } = makeStore({
      orders: [
        {
          _id: "lmsOrders-1",
          customerId: "lmsCustomers-1",
          courseId: "lmsCourses-1",
          status: "pending_payment",
          priceUsd: 90,
          externalReference: "lmsOrders-1",
        },
      ],
    });
    const found = await getPendingHandler(
      { db },
      { customerId: "lmsCustomers-1", courseId: "lmsCourses-1" }
    );
    expect(found?._id).toBe("lmsOrders-1");
  });

  it("ignores a soft-deleted order", async () => {
    const { db } = makeStore({
      orders: [
        {
          _id: "lmsOrders-1",
          customerId: "lmsCustomers-1",
          courseId: "lmsCourses-1",
          status: "pending_payment",
          priceUsd: 90,
          externalReference: "lmsOrders-1",
          deletedAt: 123,
        },
      ],
    });
    const found = await getPendingHandler(
      { db },
      { customerId: "lmsCustomers-1", courseId: "lmsCourses-1" }
    );
    expect(found).toBeNull();
  });
});

describe("updateOrderWithMpPreference", () => {
  it("stamps the preference id without changing status", async () => {
    const { db, tables } = makeStore({
      orders: [
        {
          _id: "lmsOrders-1",
          customerId: "c1",
          courseId: "k1",
          status: "pending_payment",
          priceUsd: 90,
          externalReference: "lmsOrders-1",
        },
      ],
    });
    await updatePrefHandler(
      { db },
      { orderId: "lmsOrders-1", mpPreferenceId: "pref-xyz" }
    );
    expect(tables.lmsOrders[0].mpPreferenceId).toBe("pref-xyz");
    expect(tables.lmsOrders[0].status).toBe("pending_payment");
  });
});

// ============================================================================
// createCheckout action
// ============================================================================
function makeActionCtx(opts: {
  learner: Row | null;
  enrollment: Row | null;
  course: Row | null;
  pendingOrder?: Row | null;
}) {
  const store = makeStore();
  const runQuery = vi.fn(async (ref: { __name: string }) => {
    switch (ref.__name) {
      case "getLearnerById":
        return opts.learner;
      case "getMyEnrollment":
        return opts.enrollment;
      case "getCourseForCheckout":
        return opts.course;
      case "getPendingOrder":
        return opts.pendingOrder ?? null;
      default:
        throw new Error(`unexpected runQuery: ${ref.__name}`);
    }
  });
  const created: Row[] = [];
  const prefStamps: Array<{ orderId: string; mpPreferenceId: string }> = [];
  const runMutation = vi.fn(
    async (ref: { __name: string }, args: Record<string, unknown>) => {
      if (ref.__name === "createOrder") {
        const row = {
          _id: "lmsOrders-new",
          ...args,
          status: "pending_payment",
          externalReference: "lmsOrders-new",
        };
        created.push(row);
        return row;
      }
      if (ref.__name === "updateOrderWithMpPreference") {
        prefStamps.push(args as unknown as {
          orderId: string;
          mpPreferenceId: string;
        });
        return undefined;
      }
      throw new Error(`unexpected runMutation: ${ref.__name}`);
    }
  );
  return { ctx: { runQuery, runMutation, db: store.db }, created, prefStamps };
}

const originalFetch = global.fetch;
beforeEach(() => {
  // The action constructs MercadoPagoAdapter, which validates MP env on init.
  process.env.MP_ACCESS_TOKEN = "test-access-token";
  process.env.MP_WEBHOOK_SECRET = "test-webhook-secret";
  process.env.MP_PUBLIC_KEY = "test-public-key";
  process.env.ZEPHYRA_PUBLIC_URL = "https://zephyra.test";
  process.env.CONVEX_SITE_URL = "https://corgi-88.convex.site";
});
afterEach(() => {
  global.fetch = originalFetch;
});

function mockMpPreference(id = "pref-1", initPoint = "https://mp.com/go") {
  global.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({ id, init_point: initPoint }),
  })) as unknown as typeof fetch;
}

const LEARNER = { _id: "lmsCustomers-1", email: "buyer@example.com" } as Row;
const COURSE = {
  _id: "lmsCourses-1",
  title: "Curso X",
  slug: "curso-x",
  priceUsd: 90,
} as Row;

describe("createCheckout — guards", () => {
  it("throws when the learner is not found", async () => {
    const { ctx } = makeActionCtx({
      learner: null,
      enrollment: null,
      course: COURSE,
    });
    await expect(
      checkoutHandler(ctx, {
        learnerId: "lmsCustomers-1",
        courseId: "lmsCourses-1",
      })
    ).rejects.toThrow(/Learner no encontrado/);
  });

  it("throws when already enrolled", async () => {
    const { ctx } = makeActionCtx({
      learner: LEARNER,
      enrollment: { _id: "enr-1" } as Row,
      course: COURSE,
    });
    await expect(
      checkoutHandler(ctx, {
        learnerId: "lmsCustomers-1",
        courseId: "lmsCourses-1",
      })
    ).rejects.toThrow(/Ya tenés acceso/);
  });

  it("throws when the course is not purchasable", async () => {
    const { ctx } = makeActionCtx({
      learner: LEARNER,
      enrollment: null,
      course: null, // getCourseForCheckout returns null for non-purchasable
    });
    await expect(
      checkoutHandler(ctx, {
        learnerId: "lmsCustomers-1",
        courseId: "lmsCourses-1",
      })
    ).rejects.toThrow(/no disponible para compra/);
  });
});

describe("createCheckout — order lifecycle", () => {
  it("creates a new order when none is pending, opens the preference, stamps it", async () => {
    mockMpPreference("pref-new", "https://mp.com/checkout/new");
    const { ctx, created, prefStamps } = makeActionCtx({
      learner: LEARNER,
      enrollment: null,
      course: COURSE,
      pendingOrder: null,
    });
    const res = await checkoutHandler(ctx, {
      learnerId: "lmsCustomers-1",
      courseId: "lmsCourses-1",
    });
    expect(res.redirectUrl).toBe("https://mp.com/checkout/new");
    expect(created).toHaveLength(1);
    expect(prefStamps[0]).toEqual({
      orderId: "lmsOrders-new",
      mpPreferenceId: "pref-new",
    });
  });

  it("reuses a pending order on double-click (no second order created)", async () => {
    mockMpPreference("pref-reuse", "https://mp.com/checkout/reuse");
    const pending = {
      _id: "lmsOrders-existing",
      customerId: "lmsCustomers-1",
      courseId: "lmsCourses-1",
      status: "pending_payment",
      priceUsd: 90,
      externalReference: "lmsOrders-existing",
    } as Row;
    const { ctx, created, prefStamps } = makeActionCtx({
      learner: LEARNER,
      enrollment: null,
      course: COURSE,
      pendingOrder: pending,
    });
    const res = await checkoutHandler(ctx, {
      learnerId: "lmsCustomers-1",
      courseId: "lmsCourses-1",
    });
    expect(res.redirectUrl).toBe("https://mp.com/checkout/reuse");
    // No new order minted; the preference is stamped on the EXISTING order.
    expect(created).toHaveLength(0);
    expect(prefStamps[0].orderId).toBe("lmsOrders-existing");
  });
});
