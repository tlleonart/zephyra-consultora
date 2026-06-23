/**
 * Security/correctness test for createPackCheckout stale-order reuse
 * (convex/lms/payment/checkout.ts, B2B pack checkout).
 *
 * CRITICAL bug remediated: reusing an open pending_payment pack order for
 * (organizationId, courseId) WITHOUT checking that its snapshotted seatCount +
 * total still match the freshly recomputed quote. A buyer who abandoned a
 * 10-seat order then returned to buy 25 would have the stale 10-seat order (old
 * price) reused → MP charges the 10-seat amount and the mint produces 10 seats,
 * not 25.
 *
 * Fix: reuse ONLY on an exact (seatCount, total) match; on a mismatch the stale
 * order is cancelled (so a late MP approval can't pay it) and a fresh order is
 * snapshotted at the current quote. The MP preference always carries the CURRENT
 * seatCount + server total.
 *
 * Harness: pure-handler-with-mock-ctx (no convex-test runtime). ctx.runQuery /
 * ctx.runMutation dispatch to the REAL internal handlers over one shared store —
 * the same convention as packMoneyPath.test.ts — and the MP adapter is mocked so
 * no live HTTP is made (we assert the priceUsd it is handed).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Dispatch refs carried by ctx.runQuery / ctx.runMutation.
vi.mock("../../../../convex/_generated/api", () => ({
  internal: {
    lms: {
      org: { assertOrgOwner: { __name: "assertOrgOwner" } },
      packs: {
        getCourseForPackCheckout: { __name: "getCourseForPackCheckout" },
        quotePackPriceInternal: { __name: "quotePackPriceInternal" },
        getOpenPackOrder: { __name: "getOpenPackOrder" },
        cancelPackOrder: { __name: "cancelPackOrder" },
        createPackOrder: { __name: "createPackOrder" },
        updatePackOrderWithMpPreference: {
          __name: "updatePackOrderWithMpPreference",
        },
      },
    },
  },
  api: {},
}));

// Mock the MP adapter so no HTTP is made; capture the args it is handed so we
// can assert the preference carries the CURRENT quote's priceUsd.
const createCheckoutSession = vi.fn(async (args: { priceUsd: number }) => {
  void args;
  return {
    externalId: "pref-xyz",
    redirectUrl: "https://mp.com/checkout/pref-xyz",
  };
});
vi.mock("../../../../convex/lms/payment/mercadopago", () => ({
  MercadoPagoAdapter: class {
    createCheckoutSession = createCheckoutSession;
  },
}));

import { createPackCheckout } from "../../../../convex/lms/payment/checkout";
import {
  getCourseForPackCheckout,
  quotePackPriceInternal,
  getOpenPackOrder,
  cancelPackOrder,
  createPackOrder,
  updatePackOrderWithMpPreference,
} from "../../../../convex/lms/packs";

const checkoutHandler = (createPackCheckout as any)._handler as (
  ctx: any,
  args: any
) => Promise<any>;
const courseHandler = (getCourseForPackCheckout as any)._handler;
const quoteHandler = (quotePackPriceInternal as any)._handler;
const openOrderHandler = (getOpenPackOrder as any)._handler;
const cancelHandler = (cancelPackOrder as any)._handler;
const createOrderHandler = (createPackOrder as any)._handler;
const updatePrefHandler = (updatePackOrderWithMpPreference as any)._handler;
/* eslint-enable @typescript-eslint/no-explicit-any */

interface Row {
  _id: string;
  [k: string]: unknown;
}

// Volume tiers: 1–24 ⇒ 0% self-serve; 25–49 ⇒ 10% self-serve. Course = $100/seat.
const TIERS: Row[] = [
  { _id: "tier-1", minSeats: 1, maxSeats: 24, discountPct: 0, selfCheckout: true, createdAt: 1 },
  { _id: "tier-2", minSeats: 25, maxSeats: 49, discountPct: 10, selfCheckout: true, createdAt: 1 },
];

function makeStore(seed: { orders?: Row[] } = {}) {
  const tables: Record<string, Row[]> = {
    // Deep-copy each seeded row: the handlers patch order rows in place, and the
    // module-level fixtures are shared across tests — without a per-test clone a
    // cancel/patch in one test would leak into the next.
    lmsOrders: (seed.orders ?? []).map((o) => ({ ...o })),
    lmsCourses: [
      { _id: "course-1", title: "Curso DEI", slug: "curso-dei", status: "published", isPurchasable: true, priceUsd: 100 },
    ],
    lmsVolumeDiscountTiers: [...TIERS],
    lmsOrganizations: [{ _id: "org-1", name: "Acme", ownerCustomerId: "owner-1", createdAt: 1 }],
    lmsCustomers: [{ _id: "owner-1", email: "owner@acme.com", type: "org_admin", organizationId: "org-1", activatedAt: 1, createdAt: 1 }],
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
        collect: async () => {
          const rows = tables[table] ?? [];
          return rows.filter((r) => eqs.every(([f, v]) => r[f] === v));
        },
      };
      return chain;
    }),
  };

  const ctx: Record<string, unknown> = { db };
  const dispatch = async (ref: { __name: string }, args: unknown) => {
    switch (ref.__name) {
      case "assertOrgOwner":
        return { ownerEmail: "owner@acme.com" };
      case "getCourseForPackCheckout":
        return courseHandler(ctx, args);
      case "quotePackPriceInternal":
        return quoteHandler(ctx, args);
      case "getOpenPackOrder":
        return openOrderHandler(ctx, args);
      case "cancelPackOrder":
        return cancelHandler(ctx, args);
      case "createPackOrder":
        return createOrderHandler(ctx, args);
      case "updatePackOrderWithMpPreference":
        return updatePrefHandler(ctx, args);
      default:
        throw new Error(`unexpected ref: ${ref.__name}`);
    }
  };
  ctx.runQuery = vi.fn(dispatch);
  ctx.runMutation = vi.fn(dispatch);

  return { ctx, db, tables };
}

// A stale, abandoned 10-seat pending pack order at the 10-seat price ($1000,
// 0% discount band) for (org-1, course-1).
const STALE_10_SEAT_ORDER: Row = {
  _id: "order-stale-10",
  customerId: "owner-1",
  courseId: "course-1",
  priceUsd: 1000, // 10 × $100, 0% band
  status: "pending_payment",
  externalReference: "order-stale-10",
  orderType: "pack",
  organizationId: "org-1",
  seatCount: 10,
  unitPriceUsd: 100,
  appliedDiscountPct: 0,
  createdAt: 1,
  updatedAt: 1,
};

const CHECKOUT_ARGS = {
  callerCustomerId: "owner-1",
  organizationId: "org-1",
  courseId: "course-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.MP_ACCESS_TOKEN = "test-token";
  process.env.MP_WEBHOOK_SECRET = "test-secret";
});

describe("createPackCheckout — stale pack order reuse guard (CRITICAL money path)", () => {
  it("does NOT reuse a stale 10-seat order for a 25-seat request: cancels it and charges the 25-seat price", async () => {
    const { ctx, tables } = makeStore({ orders: [STALE_10_SEAT_ORDER] });

    const res = await checkoutHandler(ctx, { ...CHECKOUT_ARGS, seatCount: 25 });

    // 25 seats × $100 × (1 − 10%) = $2250.
    const EXPECTED_TOTAL = 2250;

    // A FRESH order was created (the stale one is NOT the driver).
    expect(res.orderId).not.toBe("order-stale-10");
    const fresh = tables.lmsOrders.find((o) => o._id === res.orderId)!;
    expect(fresh.seatCount).toBe(25);
    expect(fresh.priceUsd).toBe(EXPECTED_TOTAL);

    // The stale order was superseded so a late MP approval can't pay 10 seats.
    const stale = tables.lmsOrders.find((o) => o._id === "order-stale-10")!;
    expect(stale.status).toBe("cancelled");

    // The MP preference carries the CURRENT 25-seat total — never the stale $1000.
    expect(createCheckoutSession).toHaveBeenCalledTimes(1);
    const prefArgs = createCheckoutSession.mock.calls[0][0];
    expect(prefArgs.priceUsd).toBe(EXPECTED_TOTAL);
    expect(prefArgs.priceUsd).not.toBe(1000);
  });

  it("REUSES an open order on an exact (seatCount, total) match — idempotent retry, no second order", async () => {
    // An open 25-seat order at the correct $2250 total: a true double-click retry.
    const open25: Row = {
      ...STALE_10_SEAT_ORDER,
      _id: "order-open-25",
      externalReference: "order-open-25",
      priceUsd: 2250,
      seatCount: 25,
      unitPriceUsd: 100,
      appliedDiscountPct: 10,
    };
    const { ctx, tables } = makeStore({ orders: [open25] });

    const res = await checkoutHandler(ctx, { ...CHECKOUT_ARGS, seatCount: 25 });

    // Same order reused — no new order minted, nothing cancelled.
    expect(res.orderId).toBe("order-open-25");
    expect(tables.lmsOrders.filter((o) => o.orderType === "pack")).toHaveLength(1);
    expect(tables.lmsOrders[0].status).toBe("pending_payment");
    const prefArgs = createCheckoutSession.mock.calls[0][0];
    expect(prefArgs.priceUsd).toBe(2250);
  });

  it("creates a fresh order when there is no open order at all", async () => {
    const { ctx, tables } = makeStore({ orders: [] });
    const res = await checkoutHandler(ctx, { ...CHECKOUT_ARGS, seatCount: 25 });
    expect(res.orderId).toBeDefined();
    const order = tables.lmsOrders.find((o) => o._id === res.orderId)!;
    expect(order.seatCount).toBe(25);
    expect(order.priceUsd).toBe(2250);
  });
});
