/**
 * Unit tests for convex/lms/org.ts — Org Admin domain + cross-org isolation.
 *
 * Why these cases (Sprint 3a B0, Risk R3):
 *  - requireOrgOwner is the cross-org isolation control: it must ACCEPT the
 *    org's own owner and REJECT every other caller (a different org's owner, a
 *    non-owner customer, a missing/soft-deleted caller or org). This is the gate
 *    on every pack/checkout/seat function, so its failure modes are load-bearing.
 *  - createOrganization promotes a verified customer to the single persistent
 *    Owner Admin (type "org_admin", organizationId set), is idempotent on
 *    re-submit (collapse on by_owner), and gates on email verification.
 *
 * Repo convention: pure-handler-with-mock-ctx.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  requireOrgOwner,
  createOrganization,
  getOrganizationByOwner,
} from "../../../../convex/lms/org";

/* eslint-disable @typescript-eslint/no-explicit-any */
const createOrgHandler = (createOrganization as any)._handler as (
  ctx: any,
  args: any
) => Promise<any>;
const getByOwnerHandler = (getOrganizationByOwner as any)._handler as (
  ctx: any,
  args: any
) => Promise<any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

interface Row {
  _id: string;
  [k: string]: unknown;
}

function makeStore(seed: { customers?: Row[]; orgs?: Row[] } = {}) {
  const tables: Record<string, Row[]> = {
    lmsCustomers: [...(seed.customers ?? [])],
    lmsOrganizations: [...(seed.orgs ?? [])],
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

describe("requireOrgOwner — cross-org isolation (Risk R3)", () => {
  const baseStore = () =>
    makeStore({
      customers: [
        { _id: "owner-a", email: "a@x.com", type: "org_admin", activatedAt: 1 },
        { _id: "owner-b", email: "b@x.com", type: "org_admin", activatedAt: 1 },
        { _id: "rando", email: "r@x.com", type: "individual", activatedAt: 1 },
      ],
      orgs: [
        { _id: "org-a", name: "Org A", ownerCustomerId: "owner-a", createdAt: 1 },
        { _id: "org-b", name: "Org B", ownerCustomerId: "owner-b", createdAt: 1 },
      ],
    });

  it("ACCEPTS the org's own owner and returns the org row", async () => {
    const { db } = baseStore();
    const org = await requireOrgOwner(
      { db } as never,
      "owner-a" as never,
      "org-a" as never
    );
    expect(org._id).toBe("org-a");
  });

  it("REJECTS a different org's owner (the core isolation case)", async () => {
    const { db } = baseStore();
    await expect(
      requireOrgOwner({ db } as never, "owner-b" as never, "org-a" as never)
    ).rejects.toThrow(/no autorizado/);
  });

  it("REJECTS a non-owner customer", async () => {
    const { db } = baseStore();
    await expect(
      requireOrgOwner({ db } as never, "rando" as never, "org-a" as never)
    ).rejects.toThrow(/no autorizado/);
  });

  it("REJECTS a missing caller", async () => {
    const { db } = baseStore();
    await expect(
      requireOrgOwner({ db } as never, "ghost" as never, "org-a" as never)
    ).rejects.toThrow(/no autorizado/);
  });

  it("REJECTS a missing org", async () => {
    const { db } = baseStore();
    await expect(
      requireOrgOwner({ db } as never, "owner-a" as never, "ghost-org" as never)
    ).rejects.toThrow(/organización no encontrada/);
  });

  it("REJECTS when the caller is soft-deleted", async () => {
    const { db, tables } = baseStore();
    (tables.lmsCustomers.find((c) => c._id === "owner-a") as Row).deletedAt = 99;
    await expect(
      requireOrgOwner({ db } as never, "owner-a" as never, "org-a" as never)
    ).rejects.toThrow(/no autorizado/);
  });
});

describe("createOrganization — Owner Admin creation", () => {
  it("promotes a verified customer to org_admin + creates the org", async () => {
    const { db, tables } = makeStore({
      customers: [
        { _id: "cust-1", email: "buyer@org.com", type: "individual", activatedAt: 100 },
      ],
    });
    const res = await createOrgHandler(
      { db },
      { ownerCustomerId: "cust-1", name: "Acme DEI", taxId: "30-12345678-9" }
    );
    expect(res.alreadyExisted).toBe(false);
    expect(tables.lmsOrganizations).toHaveLength(1);
    expect(tables.lmsOrganizations[0]).toMatchObject({
      name: "Acme DEI",
      taxId: "30-12345678-9",
      ownerCustomerId: "cust-1",
    });
    // Owner promoted + bound to the org; they do NOT get a seat (no seat row).
    const owner = tables.lmsCustomers[0];
    expect(owner.type).toBe("org_admin");
    expect(owner.organizationId).toBe(res.organizationId);
  });

  it("is idempotent: a re-submit for an owning customer returns the existing org", async () => {
    const { db, tables } = makeStore({
      customers: [
        { _id: "cust-1", email: "buyer@org.com", type: "org_admin", activatedAt: 100, organizationId: "lmsOrganizations-pre" },
      ],
      orgs: [
        { _id: "lmsOrganizations-pre", name: "Acme", ownerCustomerId: "cust-1", createdAt: 1 },
      ],
    });
    const res = await createOrgHandler(
      { db },
      { ownerCustomerId: "cust-1", name: "Acme Again" }
    );
    expect(res.alreadyExisted).toBe(true);
    expect(res.organizationId).toBe("lmsOrganizations-pre");
    expect(tables.lmsOrganizations).toHaveLength(1); // no second org
  });

  it("rejects an unverified (not activated) customer", async () => {
    const { db } = makeStore({
      customers: [{ _id: "cust-1", email: "x@y.com", type: "individual" }],
    });
    await expect(
      createOrgHandler({ db }, { ownerCustomerId: "cust-1", name: "Acme" })
    ).rejects.toThrow(/verificá tu email/);
  });

  it("rejects an empty org name", async () => {
    const { db } = makeStore({
      customers: [{ _id: "cust-1", email: "x@y.com", type: "individual", activatedAt: 1 }],
    });
    await expect(
      createOrgHandler({ db }, { ownerCustomerId: "cust-1", name: "   " })
    ).rejects.toThrow(/obligatorio/);
  });
});

describe("getOrganizationByOwner — self-scoped lookup", () => {
  it("returns the org the caller owns", async () => {
    const { db } = makeStore({
      orgs: [{ _id: "org-1", name: "Acme", ownerCustomerId: "cust-1", createdAt: 1 }],
    });
    const res = await getByOwnerHandler({ db }, { callerCustomerId: "cust-1" });
    expect(res?._id).toBe("org-1");
  });

  it("returns null when the caller owns no org", async () => {
    const { db } = makeStore({ orgs: [] });
    const res = await getByOwnerHandler({ db }, { callerCustomerId: "cust-1" });
    expect(res).toBeNull();
  });
});
