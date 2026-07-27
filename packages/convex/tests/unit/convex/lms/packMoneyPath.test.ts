/**
 * Release-gate + integration tests for the B2B pack money path (Sprint 3a B3/B4).
 *
 * These exercise processVerifiedPayment (the transactional core) on the PACK
 * branch + mintSeatPackForOrder + recordRevenueShare TOGETHER over a shared mock
 * DB, so the cross-mutation invariants hold end-to-end — the pack analogue of
 * paymentProcessing.test.ts. Repo convention: pure-handler-with-mock-ctx (no
 * convex-test runtime); ctx.runMutation dispatches to the REAL internal handlers
 * against the same store so the mutations share one "transaction" the way Convex
 * would.
 *
 * RELEASE GATES (must be green at sprint-end):
 *  - S3.9(a) IDEMPOTENCY: a duplicate approved pack webhook ⇒ exactly ONE
 *    lmsSeatPacks + exactly N lmsSeats. No second pack, no second seat batch.
 *  - S3.9(d) ANTI-TAMPER: a client-forged/underpaid price is ignored — the order
 *    carries the SERVER-computed total, and the webhook validates the settled
 *    amount against it (validateAmountAndCurrency discipline). An underpay/forged
 *    amount is rejected with no pack minted, no entitlement, no ledger.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Stub the generated api so ctx.runMutation(ref, args) carries a dispatch name.
vi.mock("../../../../convex/_generated/api", () => ({
  internal: {
    lms: {
      enrollments: {
        grantEnrollmentForOrder: { __name: "grantEnrollmentForOrder" },
      },
      packs: { mintSeatPackForOrder: { __name: "mintSeatPackForOrder" } },
      payment: {
        ledger: { recordRevenueShare: { __name: "recordRevenueShare" } },
        email: { sendBuyerConfirmationEmail: { __name: "sendBuyerConfirmationEmail" } },
      },
    },
  },
  api: {},
}));

import { processVerifiedPayment } from "../../../../convex/lms/payment/internal";
import { mintSeatPackForOrder } from "../../../../convex/lms/packs";
import { grantEnrollmentForOrder } from "../../../../convex/lms/enrollments";
import { recordRevenueShare } from "../../../../convex/lms/payment/ledger";

const processHandler = (processVerifiedPayment as any)._handler as (
  ctx: any,
  args: any
) => Promise<any>;
const mintHandler = (mintSeatPackForOrder as any)._handler as (
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

// In-memory store supporting the .withIndex(name, builder).first() chain the
// handlers use, plus get/insert/patch. Mirrors paymentProcessing.test.ts.
function makeStore(seed: { orders?: Row[]; courses?: Row[] } = {}) {
  const tables: Record<string, Row[]> = {
    lmsOrders: [...(seed.orders ?? [])],
    lmsCourses: [
      ...(seed.courses ?? [
        { _id: "course-1", title: "Curso DEI", slug: "curso-dei", status: "published" },
      ]),
    ],
    lmsPayments: [],
    lmsEnrollments: [],
    lmsRevenueShares: [],
    lmsSeatPacks: [],
    lmsSeats: [],
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

  const ctx = {
    db,
    runMutation: vi.fn(async (ref: { __name: string }, args: unknown) => {
      if (ref.__name === "mintSeatPackForOrder") return mintHandler(ctx, args);
      if (ref.__name === "grantEnrollmentForOrder") return grantHandler(ctx, args);
      if (ref.__name === "recordRevenueShare") return ledgerHandler(ctx, args);
      throw new Error(`unexpected runMutation ref: ${ref.__name}`);
    }),
    scheduler: { runAfter: vi.fn(async () => {}) },
  };

  return { ctx, db, tables };
}

// A pack order: 10 seats, $100/seat list, 10% band ⇒ server total $900.
const PACK_ORDER: Row = {
  _id: "order-pack-1",
  customerId: "owner-1", // the org owner (buyer)
  courseId: "course-1",
  priceUsd: 900, // SERVER-computed total (anti-tamper anchor)
  status: "pending_payment",
  externalReference: "order-pack-1",
  orderType: "pack",
  organizationId: "org-1",
  seatCount: 10,
  unitPriceUsd: 100,
  appliedDiscountPct: 10,
  createdAt: 1,
  updatedAt: 1,
};

// MP settled the $900 USD order as ARS (e.g. 900 × 162). Currency ARS, positive.
const approvedPackFetched = (id = "mp-pack-1") => ({
  id,
  status: "approved" as const,
  amount: 145800,
  currency: "ARS",
  external_reference: "order-pack-1",
  feeDetails: [{ type: "mercadopago_fee", amount: 500 }],
});

beforeEach(() => vi.clearAllMocks());

describe("pack approved happy path — mint + ledger + order paid", () => {
  it("mints exactly 1 pack + N seats, records the 80/20 split, marks order paid", async () => {
    const { ctx, tables } = makeStore({ orders: [{ ...PACK_ORDER }] });
    const res = await processHandler(ctx, {
      fetched: approvedPackFetched(),
      priorEvents: [],
    });

    expect(res.outcome).toBe("approved_pack");

    // Exactly one payment, one pack, exactly seatCount seats.
    expect(tables.lmsPayments).toHaveLength(1);
    expect(tables.lmsSeatPacks).toHaveLength(1);
    expect(tables.lmsSeats).toHaveLength(10);

    // Pack balance invariant holds from creation.
    const pack = tables.lmsSeatPacks[0];
    expect(pack).toMatchObject({
      orderId: "order-pack-1",
      organizationId: "org-1",
      courseId: "course-1",
      totalSeats: 10,
      availableSeats: 10,
      claimedSeats: 0,
    });
    expect(pack.expiresAt).toBeUndefined(); // vitalicias (V1)
    expect((pack.availableSeats as number) + (pack.claimedSeats as number)).toBeLessThanOrEqual(
      pack.totalSeats as number
    );

    // All seats are available + unclaimed at mint.
    for (const seat of tables.lmsSeats) {
      expect(seat.status).toBe("available");
      expect(seat.claimedBy).toBeUndefined();
      expect(seat.seatPackId).toBe(pack._id);
    }

    // No B2C enrollment was granted for a pack.
    expect(tables.lmsEnrollments).toHaveLength(0);

    // Revenue share: SAME 80/20 split on the pack total ($900).
    expect(tables.lmsRevenueShares).toHaveLength(1);
    expect(tables.lmsRevenueShares[0]).toMatchObject({
      grossUsd: 900,
      grossArs: 145800,
      c14CutUsd: 180, // 20% of 900
      zephyraCutUsd: 720, // 80% of 900
    });

    expect(tables.lmsOrders[0].status).toBe("paid");
  });
});

describe("S3.9(a) RELEASE GATE — duplicate pack webhook ⇒ exactly 1 pack + N seats", () => {
  it("second delivery of the same mpPaymentId mints nothing more (idempotent)", async () => {
    const { ctx, tables } = makeStore({ orders: [{ ...PACK_ORDER }] });

    const first = await processHandler(ctx, {
      fetched: approvedPackFetched(),
      priorEvents: [],
    });
    const second = await processHandler(ctx, {
      fetched: approvedPackFetched(), // SAME id "mp-pack-1"
      priorEvents: [],
    });

    expect(first.outcome).toBe("approved_pack");
    // The upstream by_mp_payment_id dedupe short-circuits the replay.
    expect(second.outcome).toBe("already_processed");

    // THE load-bearing invariant: exactly one pack, exactly N seats, no second
    // batch, one ledger row.
    expect(tables.lmsSeatPacks).toHaveLength(1);
    expect(tables.lmsSeats).toHaveLength(10);
    expect(tables.lmsPayments).toHaveLength(1);
    expect(tables.lmsRevenueShares).toHaveLength(1);
  });

  it("mint is idempotent on orderId even if re-invoked directly (by_order lookup)", async () => {
    // Defense-in-depth: even if the approved branch were re-entered for the
    // same orderId (bypassing the payment dedupe), the by_order lookup mints
    // nothing more.
    const { ctx, tables } = makeStore({ orders: [{ ...PACK_ORDER }] });

    const a = await mintHandler(ctx, { orderId: "order-pack-1" });
    const b = await mintHandler(ctx, { orderId: "order-pack-1" });

    expect(a.minted).toBe(true);
    expect(a.seatsMinted).toBe(10);
    expect(b.minted).toBe(false); // idempotent no-op
    expect(b.seatsMinted).toBe(0);
    expect(b.seatPackId).toBe(a.seatPackId); // same pack returned

    expect(tables.lmsSeatPacks).toHaveLength(1);
    expect(tables.lmsSeats).toHaveLength(10);
  });
});

describe("S3.9(d) RELEASE GATE — price tampering rejected", () => {
  it("a forged UNDERPAY (wrong currency) is rejected: no pack, no ledger, order stays pending", async () => {
    // Anti-tamper #5: the order carries the SERVER total ($900). A settled
    // payment whose currency does not match the expected settlement currency
    // (here: the attacker tries to settle in USD at a forged low amount) is
    // rejected by validateAmountAndCurrency before any entitlement.
    const { ctx, tables } = makeStore({ orders: [{ ...PACK_ORDER }] });
    const res = await processHandler(ctx, {
      fetched: {
        ...approvedPackFetched("mp-pack-tamper"),
        amount: 1, // forged underpay
        currency: "USD", // currency mismatch vs expected ARS settlement
      },
      priorEvents: [],
    });

    expect(res.outcome).toBe("amount_mismatch");
    // Nothing minted, nothing entitled, nothing recorded; order untouched.
    expect(tables.lmsSeatPacks).toHaveLength(0);
    expect(tables.lmsSeats).toHaveLength(0);
    expect(tables.lmsRevenueShares).toHaveLength(0);
    expect(tables.lmsPayments).toHaveLength(0);
    expect(tables.lmsOrders[0].status).toBe("pending_payment");
  });

  it("a non-positive settled amount is rejected (forged zero charge)", async () => {
    const { ctx, tables } = makeStore({ orders: [{ ...PACK_ORDER }] });
    const res = await processHandler(ctx, {
      fetched: {
        ...approvedPackFetched("mp-pack-zero"),
        amount: 0, // forged zero
        currency: "ARS",
      },
      priorEvents: [],
    });
    expect(res.outcome).toBe("amount_mismatch");
    expect(tables.lmsSeatPacks).toHaveLength(0);
    expect(tables.lmsSeats).toHaveLength(0);
  });

  it("the order's priceUsd is the SERVER total — a client cannot inject a price into the mint", async () => {
    // The mint reads seatCount FROM THE ORDER (server-snapshotted), never from
    // any client input. Even a tampered order missing seatCount fails closed.
    const { ctx } = makeStore({
      orders: [{ ...PACK_ORDER, seatCount: undefined }],
    });
    await expect(
      mintHandler(ctx, { orderId: "order-pack-1" })
    ).rejects.toThrow(/invalid seatCount/);
  });
});

describe("mintSeatPackForOrder — guards", () => {
  it("throws on a non-pack order (b2c order must not mint a pack)", async () => {
    const { ctx } = makeStore({
      orders: [{ ...PACK_ORDER, orderType: "b2c", seatCount: undefined }],
    });
    await expect(
      mintHandler(ctx, { orderId: "order-pack-1" })
    ).rejects.toThrow(/not a pack order/);
  });

  it("throws when the order is missing", async () => {
    const { ctx } = makeStore({ orders: [] });
    await expect(mintHandler(ctx, { orderId: "ghost" })).rejects.toThrow(
      /order not found/
    );
  });
});

describe("rejected pack payment ⇒ no pack, no ledger", () => {
  it("records a rejected payment, marks order failed, mints nothing", async () => {
    const { ctx, tables } = makeStore({ orders: [{ ...PACK_ORDER }] });
    const res = await processHandler(ctx, {
      fetched: { ...approvedPackFetched("mp-pack-rej"), status: "rejected" as const },
      priorEvents: [],
    });
    expect(res.outcome).toBe("rejected");
    expect(tables.lmsSeatPacks).toHaveLength(0);
    expect(tables.lmsSeats).toHaveLength(0);
    expect(tables.lmsRevenueShares).toHaveLength(0);
    expect(tables.lmsOrders[0].status).toBe("failed");
  });
});
