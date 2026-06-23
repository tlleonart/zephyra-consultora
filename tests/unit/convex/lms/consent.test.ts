/**
 * Unit tests for convex/lms/consent.ts — Sprint 3b Phase D2 (learner opt-in).
 *
 * Default = OPT-OUT (no row ⇒ no consent). grant flips/creates granted:true;
 * revoke flips/creates granted:false (audit-bearing, never deletes). Upsert is
 * keyed on the (learner, org, courseId) tuple — org-wide (courseId undefined)
 * and course-scoped consents are distinct rows.
 *
 * Repo convention: pure-handler-with-mock-ctx.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  grantProgressConsent,
  revokeProgressConsent,
  getMyConsentState,
} from "../../../../convex/lms/consent";

/* eslint-disable @typescript-eslint/no-explicit-any */
const grantHandler = (grantProgressConsent as any)._handler;
const revokeHandler = (revokeProgressConsent as any)._handler;
const stateHandler = (getMyConsentState as any)._handler;
/* eslint-enable @typescript-eslint/no-explicit-any */

interface Row {
  _id: string;
  [k: string]: unknown;
}

function makeStore(seed: { customers?: Row[]; consents?: Row[] } = {}) {
  const tables: Record<string, Row[]> = {
    lmsCustomers: [...(seed.customers ?? [])],
    lmsProgressConsents: [...(seed.consents ?? [])],
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
  return { db, tables };
}

const ctx = (db: unknown) => ({ db }) as never;

const LEARNER: Row = { _id: "learner-1", email: "emp@acme.com", type: "org_learner", organizationId: "org-1", activatedAt: 1 };

beforeEach(() => vi.clearAllMocks());

describe("grantProgressConsent", () => {
  it("creates a granted org-wide consent row when none exists", async () => {
    const { db, tables } = makeStore({ customers: [LEARNER] });
    const res = await grantHandler(ctx(db), {
      learnerCustomerId: "learner-1",
      organizationId: "org-1",
    });
    expect(res.granted).toBe(true);
    expect(tables.lmsProgressConsents).toHaveLength(1);
    expect(tables.lmsProgressConsents[0]).toMatchObject({
      learnerCustomerId: "learner-1",
      organizationId: "org-1",
      granted: true,
    });
    expect(tables.lmsProgressConsents[0].courseId).toBeUndefined();
  });

  it("UPSERT: re-granting an existing (revoked) row flips it, no second row", async () => {
    const { db, tables } = makeStore({
      customers: [LEARNER],
      consents: [
        { _id: "c1", learnerCustomerId: "learner-1", organizationId: "org-1", granted: false, revokedAt: 5 },
      ],
    });
    const res = await grantHandler(ctx(db), {
      learnerCustomerId: "learner-1",
      organizationId: "org-1",
    });
    expect(res.consentId).toBe("c1");
    expect(tables.lmsProgressConsents).toHaveLength(1);
    expect(tables.lmsProgressConsents[0].granted).toBe(true);
    expect(tables.lmsProgressConsents[0].revokedAt).toBeUndefined();
  });

  it("course-scoped and org-wide consents are distinct rows", async () => {
    const { db, tables } = makeStore({
      customers: [LEARNER],
      consents: [
        { _id: "c-wide", learnerCustomerId: "learner-1", organizationId: "org-1", granted: true, grantedAt: 1 },
      ],
    });
    await grantHandler(ctx(db), {
      learnerCustomerId: "learner-1",
      organizationId: "org-1",
      courseId: "course-1",
    });
    expect(tables.lmsProgressConsents).toHaveLength(2);
  });

  it("rejects a missing/soft-deleted learner", async () => {
    const { db } = makeStore({ customers: [] });
    await expect(
      grantHandler(ctx(db), { learnerCustomerId: "ghost", organizationId: "org-1" })
    ).rejects.toThrow(/learner no encontrado/);
  });
});

describe("revokeProgressConsent", () => {
  it("flips an existing granted row to granted:false + revokedAt", async () => {
    const { db, tables } = makeStore({
      customers: [LEARNER],
      consents: [
        { _id: "c1", learnerCustomerId: "learner-1", organizationId: "org-1", granted: true, grantedAt: 5 },
      ],
    });
    const res = await revokeHandler(ctx(db), {
      learnerCustomerId: "learner-1",
      organizationId: "org-1",
    });
    expect(res.granted).toBe(false);
    expect(tables.lmsProgressConsents[0].granted).toBe(false);
    expect(tables.lmsProgressConsents[0].revokedAt).toBeDefined();
  });

  it("records an explicit revoked row when none exists (default opt-out, auditable)", async () => {
    const { db, tables } = makeStore({ customers: [LEARNER] });
    await revokeHandler(ctx(db), { learnerCustomerId: "learner-1", organizationId: "org-1" });
    expect(tables.lmsProgressConsents).toHaveLength(1);
    expect(tables.lmsProgressConsents[0].granted).toBe(false);
  });
});

describe("getMyConsentState", () => {
  it("returns the learner's consent rows for the org (default = empty ⇒ opt-out)", async () => {
    const { db } = makeStore({ customers: [LEARNER] });
    const res = await stateHandler(ctx(db), { learnerCustomerId: "learner-1", organizationId: "org-1" });
    expect(res.consents).toHaveLength(0);
  });

  it("returns granted state per scope", async () => {
    const { db } = makeStore({
      customers: [LEARNER],
      consents: [
        { _id: "c1", learnerCustomerId: "learner-1", organizationId: "org-1", granted: true, grantedAt: 1 },
        { _id: "c2", learnerCustomerId: "learner-1", organizationId: "org-1", courseId: "course-1", granted: false, revokedAt: 2 },
      ],
    });
    const res = await stateHandler(ctx(db), { learnerCustomerId: "learner-1", organizationId: "org-1" });
    expect(res.consents).toHaveLength(2);
  });
});
