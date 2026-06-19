/**
 * Integration / release-gate tests for the money-path core (Sprint 2 Phase P0).
 *
 * These exercise processVerifiedPayment (the transactional core) +
 * grantEnrollmentForOrder + recordRevenueShare TOGETHER via a shared mock DB,
 * so the cross-mutation invariants hold end-to-end. The repo's convention is
 * pure-handler-with-mock-ctx (no convex-test runtime); we wire ctx.runMutation
 * to dispatch to the real internal handlers against the same mock DB so the
 * three mutations share one "transaction" the way Convex would.
 *
 * Release gates (SDD §7, Tomás-signed — must be green at sprint-end):
 *  - T1: duplicate webhook ⇒ exactly 1 payment + 1 enrollment (idempotency #3)
 *  - T2: webhook before back_url return ⇒ still enrolls (authoritative fetch)
 *  - T3: rejected payment ⇒ no enrollment, no ledger (entitlement gating #6)
 * Plus anti-tamper (#5) and order-resolution edge cases.
 *
 * fetchPaymentState / x-signature are NOT exercised here — they are the
 * adapter's job, covered by paymentMercadopago.test.ts and the sandbox e2e.
 * Here the "fetched" state is injected directly, modeling the
 * verify-then-fetch step the httpAction performs upstream.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { processVerifiedPayment } from "../../../../convex/lms/payment/internal";
import { grantEnrollmentForOrder } from "../../../../convex/lms/enrollments";
import { recordRevenueShare } from "../../../../convex/lms/payment/ledger";

/* eslint-disable @typescript-eslint/no-explicit-any */
const processHandler = (processVerifiedPayment as any)._handler as (
  ctx: any,
  args: any
) => Promise<any>;
const grantHandler = (grantEnrollmentForOrder as any)._handler as (
  ctx: any,
  args: any
) => Promise<any>;
const ledgerHandler = (recordRevenueShare as any)._handler as (
  ctx: any,
  args: any
) => Promise<any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

interface Row {
  _id: string;
  [k: string]: unknown;
}

// A tiny in-memory store that supports the .withIndex(name, builder).first()
// chain the handlers use, plus get/insert/patch. Index resolution is by the
// eq() field/value pairs the builder calls — sufficient for these handlers.
function makeStore(seed: { orders?: Row[]; courses?: Row[] } = {}) {
  const tables: Record<string, Row[]> = {
    lmsOrders: [...(seed.orders ?? [])],
    // P1.6: the approved branch reads the course (title + slug) to schedule the
    // buyer email. Seed a default course matching ORDER.courseId so the happy
    // path resolves it; tests that don't care still get a clean resolution.
    lmsCourses: [
      ...(seed.courses ?? [
        { _id: "course-1", title: "Curso de prueba", slug: "curso-de-prueba", status: "published" },
      ]),
    ],
    lmsPayments: [],
    lmsEnrollments: [],
    lmsRevenueShares: [],
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
        withIndex: (_name: string, builder: (q: { eq: (f: string, v: unknown) => unknown }) => unknown) => {
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
          const match = rows.find((r) => eqs.every(([f, v]) => r[f] === v));
          return match ?? null;
        },
      };
      return chain;
    }),
  };

  // ctx.runMutation dispatches to the real internal handlers on the SAME db —
  // models the single-transaction sharing Convex provides.
  const ctx = {
    db,
    runMutation: vi.fn(async (ref: { __name: string }, args: unknown) => {
      if (ref.__name === "grantEnrollmentForOrder") {
        return grantHandler(ctx, args);
      }
      if (ref.__name === "recordRevenueShare") {
        return ledgerHandler(ctx, args);
      }
      throw new Error(`unexpected runMutation ref: ${ref.__name}`);
    }),
    // P1.6: the approved branch schedules the buyer email. These suites don't
    // assert on the schedule (paymentBuyerEmail.test.ts does); a no-op spy keeps
    // the call from throwing on the undefined scheduler.
    scheduler: { runAfter: vi.fn(async () => {}) },
  };

  return { ctx, db, tables };
}

// The generated `internal.*` refs are opaque function references at runtime.
// Stub them so the handler's ctx.runMutation(ref, args) carries a name our
// mock can dispatch on. We mock the generated api module accordingly.
vi.mock("../../../../convex/_generated/api", () => ({
  internal: {
    lms: {
      enrollments: { grantEnrollmentForOrder: { __name: "grantEnrollmentForOrder" } },
      payment: {
        ledger: { recordRevenueShare: { __name: "recordRevenueShare" } },
        // P1.6: scheduled from the approved branch; refs must exist so the
        // handler's scheduler.runAfter(ref) call resolves a non-undefined ref.
        email: { sendBuyerConfirmationEmail: { __name: "sendBuyerConfirmationEmail" } },
      },
    },
  },
  api: {},
}));

const ORDER: Row = {
  _id: "order-1",
  customerId: "customer-1",
  courseId: "course-1",
  priceUsd: 90,
  status: "pending_payment",
  externalReference: "order-1",
  createdAt: 1,
  updatedAt: 1,
};

const approvedFetched = (id = "mp-123") => ({
  id,
  status: "approved" as const,
  amount: 16200,
  currency: "ARS",
  external_reference: "order-1",
  feeDetails: [{ type: "mercadopago_fee", amount: 100 }],
});

beforeEach(() => vi.clearAllMocks());

describe("processVerifiedPayment — approved happy path", () => {
  it("creates payment + enrollment + ledger and marks the order paid", async () => {
    const { ctx, tables } = makeStore({ orders: [{ ...ORDER }] });
    const res = await processHandler(ctx, {
      fetched: approvedFetched(),
      priorEvents: [{ eventType: "state_fetched", payload: {}, timestamp: 1 }],
    });

    expect(res.outcome).toBe("approved");
    expect(tables.lmsPayments).toHaveLength(1);
    expect(tables.lmsPayments[0]).toMatchObject({
      mpPaymentId: "mp-123",
      status: "approved",
      grossArs: 16200,
      usdAmount: 90,
    });
    // webhookEventLog carries the prior events + the approved outcome event.
    expect(
      (tables.lmsPayments[0].webhookEventLog as Array<{ eventType: string }>).some(
        (e) => e.eventType === "approved"
      )
    ).toBe(true);

    expect(tables.lmsEnrollments).toHaveLength(1);
    expect(tables.lmsEnrollments[0]).toMatchObject({
      learnerId: "customer-1",
      courseId: "course-1",
      status: "active",
    });

    expect(tables.lmsRevenueShares).toHaveLength(1);
    expect(tables.lmsRevenueShares[0]).toMatchObject({
      grossUsd: 90,
      grossArs: 16200,
      c14CutUsd: 18,
      zephyraCutUsd: 72,
      mpFees: 100,
    });

    expect(tables.lmsOrders[0].status).toBe("paid");
  });
});

describe("T1 — duplicate webhook ⇒ exactly 1 payment + 1 enrollment", () => {
  it("second delivery of the same mpPaymentId is an idempotent no-op", async () => {
    const { ctx, tables } = makeStore({ orders: [{ ...ORDER }] });

    const first = await processHandler(ctx, {
      fetched: approvedFetched(),
      priorEvents: [],
    });
    const second = await processHandler(ctx, {
      fetched: approvedFetched(), // same id "mp-123"
      priorEvents: [],
    });

    expect(first.outcome).toBe("approved");
    expect(second.outcome).toBe("already_processed");

    // The load-bearing invariant: exactly one of each, no duplication.
    expect(tables.lmsPayments).toHaveLength(1);
    expect(tables.lmsEnrollments).toHaveLength(1);
    expect(tables.lmsRevenueShares).toHaveLength(1);
  });

  it("idempotent even when the enrollment already existed (re-grant collapses)", async () => {
    const { ctx, tables } = makeStore({ orders: [{ ...ORDER }] });
    // Pre-seed an active enrollment for the same (learner, course).
    tables.lmsEnrollments.push({
      _id: "enr-pre",
      learnerId: "customer-1",
      courseId: "course-1",
      status: "active",
      progressPercent: 0,
      completedScoCount: 0,
      scoStates: {},
      updatedAt: 1,
    });

    const res = await processHandler(ctx, {
      fetched: approvedFetched(),
      priorEvents: [],
    });
    expect(res.outcome).toBe("approved");
    // grant collapses onto the existing row → still exactly 1 enrollment.
    expect(tables.lmsEnrollments).toHaveLength(1);
    expect(tables.lmsPayments).toHaveLength(1);
  });
});

describe("T2 — webhook before back_url return ⇒ still enrolls", () => {
  it("enrollment is driven by the authoritative fetched state, not back_url", async () => {
    // Model: the webhook arrives first (back_url not yet processed). The
    // handler acts purely on `fetched` (the GET /v1/payments result), so the
    // enrollment is created regardless of any client-side return.
    const { ctx, tables } = makeStore({ orders: [{ ...ORDER }] });
    const res = await processHandler(ctx, {
      fetched: approvedFetched("mp-out-of-order"),
      priorEvents: [],
    });
    expect(res.outcome).toBe("approved");
    expect(tables.lmsEnrollments).toHaveLength(1);
    expect(tables.lmsEnrollments[0].status).toBe("active");
    expect(tables.lmsOrders[0].status).toBe("paid");
  });
});

describe("T3 — rejected payment ⇒ no enrollment, no ledger", () => {
  it("records a rejected payment row, marks order failed, grants nothing", async () => {
    const { ctx, tables } = makeStore({ orders: [{ ...ORDER }] });
    const res = await processHandler(ctx, {
      fetched: { ...approvedFetched("mp-rej"), status: "rejected" as const },
      priorEvents: [],
    });

    expect(res.outcome).toBe("rejected");
    expect(tables.lmsPayments).toHaveLength(1);
    expect(tables.lmsPayments[0].status).toBe("rejected");
    expect(tables.lmsEnrollments).toHaveLength(0);
    expect(tables.lmsRevenueShares).toHaveLength(0);
    expect(tables.lmsOrders[0].status).toBe("failed");
  });

  it("cancelled payment ⇒ order cancelled, no entitlement, no ledger", async () => {
    const { ctx, tables } = makeStore({ orders: [{ ...ORDER }] });
    const res = await processHandler(ctx, {
      fetched: { ...approvedFetched("mp-cxl"), status: "cancelled" as const },
      priorEvents: [],
    });
    expect(res.outcome).toBe("cancelled");
    expect(tables.lmsPayments[0].status).toBe("cancelled");
    expect(tables.lmsEnrollments).toHaveLength(0);
    expect(tables.lmsRevenueShares).toHaveLength(0);
    expect(tables.lmsOrders[0].status).toBe("cancelled");
  });
});

describe("anti-tampering + edge cases", () => {
  it("control #5: amount/currency mismatch ⇒ no payment, no entitlement", async () => {
    const { ctx, tables } = makeStore({ orders: [{ ...ORDER }] });
    const res = await processHandler(ctx, {
      fetched: { ...approvedFetched("mp-tamper"), currency: "USD" },
      priorEvents: [],
    });
    expect(res.outcome).toBe("amount_mismatch");
    expect(tables.lmsPayments).toHaveLength(0);
    expect(tables.lmsEnrollments).toHaveLength(0);
    expect(tables.lmsOrders[0].status).toBe("pending_payment");
  });

  it("order not found ⇒ no writes", async () => {
    const { ctx, tables } = makeStore({ orders: [] });
    const res = await processHandler(ctx, {
      fetched: approvedFetched("mp-orphan"),
      priorEvents: [],
    });
    expect(res.outcome).toBe("order_not_found");
    expect(tables.lmsPayments).toHaveLength(0);
  });

  it("pending state ⇒ no durable write (next resolving webhook is first to insert)", async () => {
    const { ctx, tables } = makeStore({ orders: [{ ...ORDER }] });
    const res = await processHandler(ctx, {
      fetched: { ...approvedFetched("mp-pending"), status: "pending" as const },
      priorEvents: [],
    });
    expect(res.outcome).toBe("pending");
    expect(tables.lmsPayments).toHaveLength(0);
    expect(tables.lmsEnrollments).toHaveLength(0);
  });
});

describe("grantEnrollmentForOrder (P0.5 — internalMutation)", () => {
  it("inserts a fresh active enrollment from the order", async () => {
    const { ctx, tables } = makeStore({ orders: [{ ...ORDER }] });
    const res = await grantHandler(ctx, { orderId: "order-1" });
    expect(res.alreadyEnrolled).toBe(false);
    expect(tables.lmsEnrollments).toHaveLength(1);
    expect(tables.lmsEnrollments[0]).toMatchObject({
      learnerId: "customer-1",
      courseId: "course-1",
      status: "active",
      progressPercent: 0,
      completedScoCount: 0,
    });
  });

  it("is idempotent on an existing active enrollment (no second row)", async () => {
    const { ctx, tables } = makeStore({ orders: [{ ...ORDER }] });
    tables.lmsEnrollments.push({
      _id: "enr-x",
      learnerId: "customer-1",
      courseId: "course-1",
      status: "active",
      progressPercent: 50,
      completedScoCount: 1,
      scoStates: {},
      updatedAt: 1,
    });
    const res = await grantHandler(ctx, { orderId: "order-1" });
    expect(res.alreadyEnrolled).toBe(true);
    expect(res.enrollmentId).toBe("enr-x");
    expect(tables.lmsEnrollments).toHaveLength(1);
  });

  it("throws when the order is missing", async () => {
    const { ctx } = makeStore({ orders: [] });
    await expect(grantHandler(ctx, { orderId: "ghost" })).rejects.toThrow(
      /order not found/
    );
  });
});

describe("recordRevenueShare (P0.6 — internalMutation)", () => {
  it("computes the 80/20 split + YYYY-MM period + null payout", async () => {
    const { ctx, tables } = makeStore();
    await ledgerHandler(ctx, {
      paymentId: "lmsPayments-1",
      grossUsd: 90,
      grossArs: 16200,
      feeDetails: [{ type: "fee", amount: 120 }],
    });
    expect(tables.lmsRevenueShares).toHaveLength(1);
    const row = tables.lmsRevenueShares[0];
    expect(row.c14CutUsd).toBe(18);
    expect(row.zephyraCutUsd).toBe(72);
    expect(row.mpFees).toBe(120);
    expect(row.payoutId).toBeUndefined();
    expect(typeof row.period).toBe("string");
    expect((row.period as string).length).toBe(7);
  });

  it("is idempotent per payment (no double-count)", async () => {
    const { ctx, tables } = makeStore();
    const args = { paymentId: "lmsPayments-1", grossUsd: 90, grossArs: 16200 };
    await ledgerHandler(ctx, args);
    await ledgerHandler(ctx, args);
    expect(tables.lmsRevenueShares).toHaveLength(1);
  });
});
