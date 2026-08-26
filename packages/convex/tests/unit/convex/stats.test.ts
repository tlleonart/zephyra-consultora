/**
 * Unit tests for convex/stats.ts — getDashboardStats.
 *
 * Why these cases (C-05):
 *  - Auth gate: missing / soft-deleted / inactive caller must throw, mirroring
 *    every other admin-only query in the repo.
 *  - The three counts C-05 adds (lms, adminUsers, serviceBlocks) each need a
 *    soft-delete-exclusion case, same convention as the eight pre-existing
 *    counts.
 *  - lms specifically needs an archived-exclusion case: schema.ts's E03 note
 *    says an archived lmsCourses row is a superseded reingest copy, not part
 *    of what an admin manages day to day — counting it would be misleading
 *    (see the comment in stats.ts).
 *  - trash stays a fixed 6-table sum; a serviceBlocks-in-trash row must NOT
 *    move the `trash` count (documented gap: convex/trash.ts + TrashList
 *    don't support restoring serviceBlocks yet, so surfacing it here would
 *    make the dashboard number diverge from what /admin/trash shows).
 *
 * Repo convention: pure-handler-with-mock-ctx (see convex/lms/org.test.ts).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDashboardStats } from "../../../convex/stats";

/* eslint-disable @typescript-eslint/no-explicit-any */
const handler = (getDashboardStats as any)._handler as (
  ctx: any,
  args: any
) => Promise<any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

interface Row {
  _id: string;
  [k: string]: unknown;
}

function makeStore(seed: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {};
  for (const [table, rows] of Object.entries(seed)) {
    tables[table] = [...rows];
  }

  const db = {
    get: vi.fn(async (id: string) => {
      for (const rows of Object.values(tables)) {
        const found = rows.find((r) => r._id === id);
        if (found) return found;
      }
      return null;
    }),
    query: vi.fn((table: string) => {
      let rows = tables[table] ?? [];
      const chain = {
        filter: (
          fn: (q: {
            field: (name: string) => { __f: string };
            eq: (ref: { __f: string }, v: unknown) => unknown;
            neq: (ref: { __f: string }, v: unknown) => unknown;
          }) => { type: "eq" | "neq"; field: string; value: unknown }
        ) => {
          const q = {
            field: (name: string) => ({ __f: name }),
            eq: (ref: { __f: string }, value: unknown) => ({
              type: "eq" as const,
              field: ref.__f,
              value,
            }),
            neq: (ref: { __f: string }, value: unknown) => ({
              type: "neq" as const,
              field: ref.__f,
              value,
            }),
          };
          const cond = fn(q);
          rows = rows.filter((r) =>
            cond.type === "eq" ? r[cond.field] === cond.value : r[cond.field] !== cond.value
          );
          return chain;
        },
        collect: async () => rows,
      };
      return chain;
    }),
  };

  return { db, tables };
}

beforeEach(() => vi.clearAllMocks());

const AUTH_USER: Row = {
  _id: "admin-1",
  email: "admin@zephyra.test",
  name: "Admin One",
  isActive: true,
};

describe("getDashboardStats — auth gate", () => {
  it("throws when the caller does not exist", async () => {
    const { db } = makeStore({});
    await expect(handler({ db }, { userId: "ghost" })).rejects.toThrow("No autorizado");
  });

  it("throws when the caller is soft-deleted", async () => {
    const { db } = makeStore({
      adminUsers: [{ ...AUTH_USER, deletedAt: 1 }],
    });
    await expect(handler({ db }, { userId: "admin-1" })).rejects.toThrow("No autorizado");
  });

  it("throws when the caller is inactive", async () => {
    const { db } = makeStore({
      adminUsers: [{ ...AUTH_USER, isActive: false }],
    });
    await expect(handler({ db }, { userId: "admin-1" })).rejects.toThrow("No autorizado");
  });
});

describe("getDashboardStats — counts (C-05)", () => {
  const baseStore = () =>
    makeStore({
      adminUsers: [
        AUTH_USER,
        { _id: "admin-2", email: "b@x.com", name: "Admin Two", isActive: true },
        { _id: "admin-3", email: "c@x.com", name: "Admin Three", isActive: true, deletedAt: 5 },
      ],
      blogPosts: [
        { _id: "b1", title: "P1", status: "published" },
        { _id: "b2", title: "P2", status: "published" },
        { _id: "b3", title: "P3", status: "draft" },
        { _id: "b4", title: "P4", status: "draft", deletedAt: 9 },
      ],
      teamMembers: [
        { _id: "t1", name: "T1" },
        { _id: "t2", name: "T2" },
        { _id: "t3", name: "T3", deletedAt: 9 },
      ],
      projects: [{ _id: "p1", title: "Proj" }],
      services: [{ _id: "s1", title: "Serv" }],
      clients: [{ _id: "c1", name: "Client" }],
      alliances: [{ _id: "al1", name: "Alliance" }],
      newsletterSubscribers: [
        { _id: "n1", isActive: true },
        { _id: "n2", isActive: true },
        { _id: "n3", isActive: false },
      ],
      lmsCourses: [
        { _id: "lc1", title: "Course 1", status: "published" },
        { _id: "lc2", title: "Course 2", status: "draft" },
        { _id: "lc3", title: "Course 3", status: "archived" },
        { _id: "lc4", title: "Course 4", status: "published", deletedAt: 9 },
      ],
      serviceBlocks: [
        { _id: "sb1", title: "Block 1" },
        { _id: "sb2", title: "Block 2" },
        { _id: "sb3", title: "Block 3", deletedAt: 9 },
      ],
    });

  it("returns the pre-existing eight counts unchanged", async () => {
    const { db } = baseStore();
    const result = await handler({ db }, { userId: "admin-1" });

    expect(result.blog).toEqual({ total: 3, published: 2, drafts: 1 });
    expect(result.team).toBe(2);
    expect(result.projects).toBe(1);
    expect(result.services).toBe(1);
    expect(result.clients).toBe(1);
    expect(result.alliances).toBe(1);
    expect(result.newsletter).toEqual({ total: 3, active: 2 });
  });

  it("adds lms — excludes soft-deleted AND archived courses", async () => {
    const { db } = baseStore();
    const result = await handler({ db }, { userId: "admin-1" });

    // lc1 (published) + lc2 (draft) count; lc3 (archived) and lc4 (deleted) don't.
    expect(result.lms).toEqual({ total: 2, published: 1, drafts: 1 });
  });

  it("adds adminUsers — excludes soft-deleted, includes the caller", async () => {
    const { db } = baseStore();
    const result = await handler({ db }, { userId: "admin-1" });

    // admin-1 + admin-2 count; admin-3 is soft-deleted.
    expect(result.adminUsers).toBe(2);
  });

  it("adds serviceBlocks — excludes soft-deleted", async () => {
    const { db } = baseStore();
    const result = await handler({ db }, { userId: "admin-1" });

    expect(result.serviceBlocks).toBe(2);
  });

  it("trash stays a 6-table sum and does not count a soft-deleted serviceBlocks row", async () => {
    const { db } = baseStore();
    const result = await handler({ db }, { userId: "admin-1" });

    // Only b4 (blogPosts) and t3 (teamMembers) are soft-deleted among the six
    // tables trash sums; sb3 (serviceBlocks) is deliberately not one of them.
    expect(result.trash).toBe(2);
  });
});
