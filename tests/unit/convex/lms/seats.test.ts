/**
 * Unit tests for convex/lms/seats.ts — Sprint 3b Phase C (invite/claim/release)
 * + Phase D1 (roster / aggregate / nominal gate).
 *
 * RELEASE GATES (must be green at sprint-end):
 *  - S3.9(b) CLAIM REPLAY: claimSeat with the SAME claimRequestId ⇒ exactly ONE
 *    enrollment + ONE seat consumed (no double).
 *  - S3.9(c) OVER-CLAIM: claimSeat when availableSeats === 0 ⇒ rejected, balance
 *    intact.
 *  - S3.9(e) NOMINAL GATE: getNominalProgress without an lmsProgressConsents row
 *    ⇒ DENIED at the function.
 *  Plus: release zero-engagement gate (started seat NOT releasable), re-invite
 *  idempotency, enrollment-dedup (no two active enrollments same course).
 *
 * Repo convention: pure-handler-with-mock-ctx. We extract each function's
 * `_handler` and drive it over an in-memory store that supports the
 * .withIndex(name, builder).first()/.collect() chain plus get/insert/patch.
 *
 * The invite/claim use the real HMAC helper (convex/model/passwords.ts) over Web
 * Crypto — Node 20 has it natively (same as auth.test.ts), so the token round-
 * trips exactly as in production.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  requestSeatInvite,
  claimSeat,
  releaseSeat,
  getOrgRoster,
  getOrgSeatPacks,
  getOrgCourseProgress,
  getNominalProgress,
} from "../../../../convex/lms/seats";
import { hashOpaqueToken } from "../../../../convex/model/passwords";

/* eslint-disable @typescript-eslint/no-explicit-any */
const inviteHandler = (requestSeatInvite as any)._handler;
const claimHandler = (claimSeat as any)._handler;
const releaseHandler = (releaseSeat as any)._handler;
const rosterHandler = (getOrgRoster as any)._handler;
const seatPacksHandler = (getOrgSeatPacks as any)._handler;
const aggregateHandler = (getOrgCourseProgress as any)._handler;
const nominalHandler = (getNominalProgress as any)._handler;
/* eslint-enable @typescript-eslint/no-explicit-any */

interface Row {
  _id: string;
  [k: string]: unknown;
}

function makeStore(
  seed: {
    customers?: Row[];
    orgs?: Row[];
    packs?: Row[];
    seats?: Row[];
    enrollments?: Row[];
    tokens?: Row[];
    consents?: Row[];
  } = {}
) {
  const tables: Record<string, Row[]> = {
    lmsCustomers: [...(seed.customers ?? [])],
    lmsOrganizations: [...(seed.orgs ?? [])],
    lmsSeatPacks: [...(seed.packs ?? [])],
    lmsSeats: [...(seed.seats ?? [])],
    lmsEnrollments: [...(seed.enrollments ?? [])],
    lmsMagicLinkTokens: [...(seed.tokens ?? [])],
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

// A standard org + owner + a minted pack of 2 available seats for course-1.
function baseSeed(overrides: { availableSeats?: number; seatStatuses?: string[] } = {}) {
  const availableSeats = overrides.availableSeats ?? 2;
  const seatStatuses = overrides.seatStatuses ?? ["available", "available"];
  return {
    customers: [
      { _id: "owner-1", email: "owner@acme.com", type: "org_admin", activatedAt: 1, organizationId: "org-1" },
    ] as Row[],
    orgs: [{ _id: "org-1", name: "Acme", ownerCustomerId: "owner-1", createdAt: 1 }],
    packs: [
      {
        _id: "pack-1",
        orderId: "order-1",
        organizationId: "org-1",
        courseId: "course-1",
        totalSeats: 2,
        availableSeats,
        claimedSeats: 2 - availableSeats,
        validFrom: 1,
        createdAt: 1,
      },
    ],
    seats: seatStatuses.map((status, i) => ({
      _id: `seat-${i + 1}`,
      seatPackId: "pack-1",
      status,
      createdAt: 1,
    })),
  };
}

beforeEach(() => vi.clearAllMocks());

// ============================================================================
// C1 — requestSeatInvite
// ============================================================================
describe("requestSeatInvite — org-owner-gated magic-link issue", () => {
  it("issues a token + claimRequestId for an owner inviting into a pack with capacity", async () => {
    const { db, tables } = makeStore(baseSeed());
    const res = await inviteHandler(db_ctx(db), {
      callerCustomerId: "owner-1",
      organizationId: "org-1",
      seatPackId: "pack-1",
      employeeEmail: "Employee@Acme.com",
    });
    expect(res.alreadyPending).toBe(false);
    expect(typeof res.rawToken).toBe("string");
    expect(typeof res.claimRequestId).toBe("string");
    // Exactly one token row minted, lowercased email, invite purpose.
    expect(tables.lmsMagicLinkTokens).toHaveLength(1);
    expect(tables.lmsMagicLinkTokens[0]).toMatchObject({
      email: "employee@acme.com",
      purpose: "seat_invite",
      seatPackId: "pack-1",
    });
  });

  it("REJECTS a non-owner caller (cross-org isolation)", async () => {
    const seed = baseSeed();
    seed.customers.push({ _id: "rando", email: "r@x.com", type: "individual", activatedAt: 1 });
    const { db } = makeStore(seed);
    await expect(
      inviteHandler(db_ctx(db), {
        callerCustomerId: "rando",
        organizationId: "org-1",
        seatPackId: "pack-1",
        employeeEmail: "e@acme.com",
      })
    ).rejects.toThrow(/no autorizado/);
  });

  it("BLOCKS inviting into a pack with zero available seats", async () => {
    const { db } = makeStore(baseSeed({ availableSeats: 0, seatStatuses: ["claimed", "claimed"] }));
    await expect(
      inviteHandler(db_ctx(db), {
        callerCustomerId: "owner-1",
        organizationId: "org-1",
        seatPackId: "pack-1",
        employeeEmail: "e@acme.com",
      })
    ).rejects.toThrow(/no tiene asientos disponibles/);
  });

  it("RE-INVITE IDEMPOTENCY: a pending unexpired invite is not re-issued", async () => {
    const now = Date.now();
    const seed = baseSeed();
    const { db, tables } = makeStore({
      ...seed,
      tokens: [
        {
          _id: "tok-pending",
          email: "employee@acme.com",
          tokenHash: "deadbeef",
          purpose: "seat_invite",
          seatPackId: "pack-1",
          expiresAt: now + 1_000_000,
          createdAt: now,
        },
      ],
    });
    const res = await inviteHandler(db_ctx(db), {
      callerCustomerId: "owner-1",
      organizationId: "org-1",
      seatPackId: "pack-1",
      employeeEmail: "employee@acme.com",
    });
    expect(res.alreadyPending).toBe(true);
    expect(res.rawToken).toBeNull();
    // No second token minted.
    expect(tables.lmsMagicLinkTokens).toHaveLength(1);
  });

  it("RE-INVITE TO A DIFFERENT PACK is NOT swallowed: a pending invite to pack-1 does not suppress a fresh invite to pack-2 (same email)", async () => {
    const now = Date.now();
    const seed = baseSeed();
    // A second pack in the same org with capacity, for the same employee email.
    seed.packs.push({
      _id: "pack-2",
      orderId: "order-2",
      organizationId: "org-1",
      courseId: "course-2",
      totalSeats: 1,
      availableSeats: 1,
      claimedSeats: 0,
      validFrom: 1,
      createdAt: 1,
    });
    seed.seats.push({ _id: "seat-p2", seatPackId: "pack-2", status: "available", createdAt: 1 });
    const { db, tables } = makeStore({
      ...seed,
      tokens: [
        {
          // A live pending invite for pack-1.
          _id: "tok-pack1",
          email: "employee@acme.com",
          tokenHash: "deadbeef",
          purpose: "seat_invite",
          seatPackId: "pack-1",
          expiresAt: now + 1_000_000,
          createdAt: now,
        },
      ],
    });
    // Inviting the SAME email to pack-2 must NOT be swallowed by the pack-1 token.
    const res = await inviteHandler(db_ctx(db), {
      callerCustomerId: "owner-1",
      organizationId: "org-1",
      seatPackId: "pack-2",
      employeeEmail: "employee@acme.com",
    });
    expect(res.alreadyPending).toBe(false);
    expect(typeof res.rawToken).toBe("string");
    // A second token row minted, bound to pack-2 (so the action sends the email).
    expect(tables.lmsMagicLinkTokens).toHaveLength(2);
    const pack2Token = tables.lmsMagicLinkTokens.find((t) => t.seatPackId === "pack-2");
    expect(pack2Token).toBeDefined();
    expect(pack2Token?.purpose).toBe("seat_invite");
  });
});

// ============================================================================
// C2 — claimSeat (idempotency + over-claim + enrollment-dedup)
// ============================================================================
describe("claimSeat — claim → enrollment", () => {
  async function seedWithLiveInvite() {
    const rawToken = "a".repeat(64);
    const tokenHash = await hashOpaqueToken(rawToken);
    const now = Date.now();
    const seed = baseSeed();
    const store = makeStore({
      ...seed,
      tokens: [
        {
          _id: "tok-1",
          email: "employee@acme.com",
          tokenHash,
          purpose: "seat_invite",
          seatPackId: "pack-1",
          expiresAt: now + 1_000_000,
          createdAt: now,
        },
      ],
    });
    return { ...store, rawToken };
  }

  it("happy path: creates an org_learner, claims a seat, mints one active enrollment", async () => {
    const { db, tables, rawToken } = await seedWithLiveInvite();
    const res = await claimHandler(db_ctx(db), {
      token: rawToken,
      claimRequestId: "claim-xyz",
      organizationId: "org-1",
      seatPackId: "pack-1",
      employeeEmail: "employee@acme.com",
    });
    expect(res.alreadyClaimed).toBe(false);

    // The org_learner was created.
    const learner = tables.lmsCustomers.find((c) => c.email === "employee@acme.com");
    expect(learner?.type).toBe("org_learner");
    expect(learner?.organizationId).toBe("org-1");

    // Exactly one enrollment, active, seatId set, progressPercent 0.
    expect(tables.lmsEnrollments).toHaveLength(1);
    expect(tables.lmsEnrollments[0]).toMatchObject({
      status: "active",
      progressPercent: 0,
      seatId: res.seatId,
      claimRequestId: "claim-xyz",
    });

    // Seat is claimed; pack balance: available 2→1, claimed 0→1.
    const seat = tables.lmsSeats.find((s) => s._id === res.seatId);
    expect(seat?.status).toBe("claimed");
    const pack = tables.lmsSeatPacks[0];
    expect(pack.availableSeats).toBe(1);
    expect(pack.claimedSeats).toBe(1);
    // Token burned.
    expect(tables.lmsMagicLinkTokens[0].usedAt).toBeDefined();
  });

  it("S3.9(b) RELEASE GATE — replay (same claimRequestId) ⇒ exactly ONE enrollment + ONE seat consumed", async () => {
    const { db, tables, rawToken } = await seedWithLiveInvite();
    const first = await claimHandler(db_ctx(db), {
      token: rawToken,
      claimRequestId: "claim-replay",
      organizationId: "org-1",
      seatPackId: "pack-1",
      employeeEmail: "employee@acme.com",
    });
    // The token is now burned; the replay short-circuits on claimRequestId
    // BEFORE the token check, so it returns the existing enrollment.
    const second = await claimHandler(db_ctx(db), {
      token: rawToken,
      claimRequestId: "claim-replay",
      organizationId: "org-1",
      seatPackId: "pack-1",
      employeeEmail: "employee@acme.com",
    });

    expect(first.alreadyClaimed).toBe(false);
    expect(second.alreadyClaimed).toBe(true);
    expect(second.enrollmentId).toBe(first.enrollmentId);
    expect(second.seatId).toBe(first.seatId);

    // THE load-bearing invariant: exactly one enrollment, one claimed seat.
    expect(tables.lmsEnrollments).toHaveLength(1);
    expect(tables.lmsSeats.filter((s) => s.status === "claimed")).toHaveLength(1);
    const pack = tables.lmsSeatPacks[0];
    expect(pack.availableSeats).toBe(1);
    expect(pack.claimedSeats).toBe(1);
  });

  it("S3.9(c) RELEASE GATE — over-claim when availableSeats === 0 ⇒ rejected, balance intact", async () => {
    // A pack fully claimed: 0 available, 2 claimed. A fresh invite token exists,
    // but there is no seat to claim.
    const rawToken = "b".repeat(64);
    const tokenHash = await hashOpaqueToken(rawToken);
    const now = Date.now();
    const seed = baseSeed({ availableSeats: 0, seatStatuses: ["claimed", "claimed"] });
    const { db, tables } = makeStore({
      ...seed,
      tokens: [
        {
          _id: "tok-oc",
          email: "employee@acme.com",
          tokenHash,
          purpose: "seat_invite",
          seatPackId: "pack-1",
          expiresAt: now + 1_000_000,
          createdAt: now,
        },
      ],
    });
    await expect(
      claimHandler(db_ctx(db), {
        token: rawToken,
        claimRequestId: "claim-oc",
        organizationId: "org-1",
        seatPackId: "pack-1",
        employeeEmail: "employee@acme.com",
      })
    ).rejects.toThrow(/no hay asientos disponibles/);

    // Balance intact: no new enrollment, claimed count unchanged.
    expect(tables.lmsEnrollments).toHaveLength(0);
    const pack = tables.lmsSeatPacks[0];
    expect(pack.availableSeats).toBe(0);
    expect(pack.claimedSeats).toBe(2);
  });

  it("ENROLLMENT DEDUP — a learner with an existing active enrollment for the course is rejected", async () => {
    const rawToken = "c".repeat(64);
    const tokenHash = await hashOpaqueToken(rawToken);
    const now = Date.now();
    const seed = baseSeed();
    // Pre-existing org_learner with an active enrollment for course-1.
    seed.customers.push({
      _id: "learner-1",
      email: "employee@acme.com",
      type: "org_learner",
      organizationId: "org-1",
      activatedAt: 1,
    });
    const { db, tables } = makeStore({
      ...seed,
      enrollments: [
        {
          _id: "enr-pre",
          learnerId: "learner-1",
          courseId: "course-1",
          status: "active",
          progressPercent: 0,
          completedScoCount: 0,
          updatedAt: 1,
        },
      ],
      tokens: [
        {
          _id: "tok-dup",
          email: "employee@acme.com",
          tokenHash,
          purpose: "seat_invite",
          seatPackId: "pack-1",
          expiresAt: now + 1_000_000,
          createdAt: now,
        },
      ],
    });
    await expect(
      claimHandler(db_ctx(db), {
        token: rawToken,
        claimRequestId: "claim-dup",
        organizationId: "org-1",
        seatPackId: "pack-1",
        employeeEmail: "employee@acme.com",
      })
    ).rejects.toThrow(/ya tiene una inscripción activa/);
    // No second enrollment, no seat consumed.
    expect(tables.lmsEnrollments).toHaveLength(1);
    expect(tables.lmsSeatPacks[0].claimedSeats).toBe(0);
  });

  it("rejects a burned token (non-replay: different claimRequestId)", async () => {
    const { db, rawToken, tables } = await seedWithLiveInvite();
    await claimHandler(db_ctx(db), {
      token: rawToken,
      claimRequestId: "claim-a",
      organizationId: "org-1",
      seatPackId: "pack-1",
      employeeEmail: "employee@acme.com",
    });
    // Same token, NEW claimRequestId ⇒ token already used ⇒ rejected.
    await expect(
      claimHandler(db_ctx(db), {
        token: rawToken,
        claimRequestId: "claim-b",
        organizationId: "org-1",
        seatPackId: "pack-1",
        employeeEmail: "employee@acme.com",
      })
    ).rejects.toThrow(/ya fue usada/);
    expect(tables.lmsEnrollments).toHaveLength(1);
  });

  it("CROSS-PACK GUARD — a seat_invite token bound to pack-1 is REJECTED when claimed against a different pack of the same org", async () => {
    const rawToken = "d".repeat(64);
    const tokenHash = await hashOpaqueToken(rawToken);
    const now = Date.now();
    const seed = baseSeed();
    // A second pack in the SAME org with an available seat.
    seed.packs.push({
      _id: "pack-2",
      orderId: "order-2",
      organizationId: "org-1",
      courseId: "course-2",
      totalSeats: 1,
      availableSeats: 1,
      claimedSeats: 0,
      validFrom: 1,
      createdAt: 1,
    });
    seed.seats.push({ _id: "seat-p2", seatPackId: "pack-2", status: "available", createdAt: 1 });
    const { db, tables } = makeStore({
      ...seed,
      tokens: [
        {
          _id: "tok-bound-p1",
          email: "employee@acme.com",
          tokenHash,
          purpose: "seat_invite",
          seatPackId: "pack-1", // bound to pack-1
          expiresAt: now + 1_000_000,
          createdAt: now,
        },
      ],
    });
    // Attempt to redeem the pack-1 token against pack-2 (URL tamper).
    await expect(
      claimHandler(db_ctx(db), {
        token: rawToken,
        claimRequestId: "claim-cross",
        organizationId: "org-1",
        seatPackId: "pack-2",
        employeeEmail: "employee@acme.com",
      })
    ).rejects.toThrow(/inválida para este pack/);
    // No seat consumed on pack-2, no enrollment minted, token NOT burned.
    expect(tables.lmsEnrollments).toHaveLength(0);
    expect(tables.lmsSeats.find((s) => s._id === "seat-p2")?.status).toBe("available");
    expect(tables.lmsMagicLinkTokens[0].usedAt).toBeUndefined();
  });

  it("B2C-TOKEN GUARD — a learner_activation token is REJECTED by claimSeat", async () => {
    const rawToken = "e".repeat(64);
    const tokenHash = await hashOpaqueToken(rawToken);
    const now = Date.now();
    const seed = baseSeed();
    const { db, tables } = makeStore({
      ...seed,
      tokens: [
        {
          _id: "tok-b2c",
          email: "employee@acme.com",
          tokenHash,
          // A B2C activation token (no seatPackId) must not be honored here.
          purpose: "learner_activation",
          expiresAt: now + 1_000_000,
          createdAt: now,
        },
      ],
    });
    await expect(
      claimHandler(db_ctx(db), {
        token: rawToken,
        claimRequestId: "claim-b2c",
        organizationId: "org-1",
        seatPackId: "pack-1",
        employeeEmail: "employee@acme.com",
      })
    ).rejects.toThrow(/inválida para esta operación/);
    expect(tables.lmsEnrollments).toHaveLength(0);
    expect(tables.lmsMagicLinkTokens[0].usedAt).toBeUndefined();
  });
});

// ============================================================================
// C3 — releaseSeat (zero-engagement gate)
// ============================================================================
describe("releaseSeat — zero-engagement gate + status change", () => {
  function claimedSeed(enrollmentOverrides: Record<string, unknown> = {}) {
    return {
      customers: [
        { _id: "owner-1", email: "owner@acme.com", type: "org_admin", activatedAt: 1, organizationId: "org-1" },
        { _id: "learner-1", email: "emp@acme.com", type: "org_learner", organizationId: "org-1", activatedAt: 1 },
      ] as Row[],
      orgs: [{ _id: "org-1", name: "Acme", ownerCustomerId: "owner-1", createdAt: 1 }],
      packs: [
        {
          _id: "pack-1",
          orderId: "order-1",
          organizationId: "org-1",
          courseId: "course-1",
          totalSeats: 2,
          availableSeats: 1,
          claimedSeats: 1,
          validFrom: 1,
          createdAt: 1,
        },
      ],
      seats: [
        { _id: "seat-1", seatPackId: "pack-1", status: "claimed", claimedBy: "learner-1", claimedAt: 5, claimRequestId: "claim-1", createdAt: 1 },
        { _id: "seat-2", seatPackId: "pack-1", status: "available", createdAt: 1 },
      ],
      enrollments: [
        {
          _id: "enr-1",
          seatId: "seat-1",
          learnerId: "learner-1",
          courseId: "course-1",
          status: "active",
          progressPercent: 0,
          completedScoCount: 0,
          updatedAt: 5,
          ...enrollmentOverrides,
        },
      ],
    };
  }

  it("releases a zero-engagement seat: status→released, balance restored, enrollment expired (no deletedBy)", async () => {
    const { db, tables } = makeStore(claimedSeed());
    const res = await releaseHandler(db_ctx(db), {
      callerCustomerId: "owner-1",
      organizationId: "org-1",
      seatId: "seat-1",
    });
    expect(res.released).toBe(true);

    const seat = tables.lmsSeats.find((s) => s._id === "seat-1");
    expect(seat?.status).toBe("released");
    expect(seat?.claimedBy).toBeUndefined();

    const pack = tables.lmsSeatPacks[0];
    expect(pack.availableSeats).toBe(2);
    expect(pack.claimedSeats).toBe(0);

    const enr = tables.lmsEnrollments.find((e) => e._id === "enr-1");
    expect(enr?.status).toBe("expired");
    expect(enr?.seatId).toBeUndefined();
    // The actor is an org_admin — NOT a staff soft-delete.
    expect(enr?.deletedBy).toBeUndefined();
  });

  it("RELEASE BLOCKED — a learner who started (progress>0) is NOT releasable", async () => {
    const { db, tables } = makeStore(claimedSeed({ progressPercent: 25, firstTouchedAt: 99 }));
    await expect(
      releaseHandler(db_ctx(db), {
        callerCustomerId: "owner-1",
        organizationId: "org-1",
        seatId: "seat-1",
      })
    ).rejects.toThrow(/ya comenzó el curso/);
    // Untouched.
    expect(tables.lmsSeats.find((s) => s._id === "seat-1")?.status).toBe("claimed");
    expect(tables.lmsSeatPacks[0].claimedSeats).toBe(1);
  });

  it("RELEASE BLOCKED — a learner with a recorded score is NOT releasable", async () => {
    const { db } = makeStore(claimedSeed({ scoreRaw: 80 }));
    await expect(
      releaseHandler(db_ctx(db), {
        callerCustomerId: "owner-1",
        organizationId: "org-1",
        seatId: "seat-1",
      })
    ).rejects.toThrow(/ya comenzó el curso/);
  });

  it("REJECTS a non-owner caller", async () => {
    const seed = claimedSeed();
    seed.customers.push({ _id: "rando", email: "r@x.com", type: "individual", activatedAt: 1 });
    const { db } = makeStore(seed);
    await expect(
      releaseHandler(db_ctx(db), {
        callerCustomerId: "rando",
        organizationId: "org-1",
        seatId: "seat-1",
      })
    ).rejects.toThrow(/no autorizado/);
  });
});

// ============================================================================
// D1 — roster (display only) + aggregate (no identities)
// ============================================================================
describe("getOrgRoster — membership, display name only", () => {
  it("lists claimed-seat learners by email, no progress fields", async () => {
    const { db } = makeStore({
      customers: [
        { _id: "owner-1", email: "owner@acme.com", type: "org_admin", activatedAt: 1, organizationId: "org-1" },
        { _id: "learner-1", email: "emp@acme.com", type: "org_learner", organizationId: "org-1", activatedAt: 1 },
      ],
      orgs: [{ _id: "org-1", name: "Acme", ownerCustomerId: "owner-1", createdAt: 1 }],
      packs: [
        { _id: "pack-1", orderId: "o1", organizationId: "org-1", courseId: "course-1", totalSeats: 2, availableSeats: 1, claimedSeats: 1, validFrom: 1, createdAt: 1 },
      ],
      seats: [
        { _id: "seat-1", seatPackId: "pack-1", status: "claimed", claimedBy: "learner-1", claimedAt: 5, createdAt: 1 },
        { _id: "seat-2", seatPackId: "pack-1", status: "available", createdAt: 1 },
      ],
    });
    const res = await rosterHandler(db_ctx(db), { callerCustomerId: "owner-1", organizationId: "org-1" });
    expect(res.members).toHaveLength(1);
    expect(res.members[0]).toMatchObject({ email: "emp@acme.com", courseId: "course-1" });
    expect(res.members[0]).not.toHaveProperty("progressPercent");
  });
});

// ============================================================================
// D1 — getOrgSeatPacks (pack capacity listing — pure Access-side read)
// ============================================================================
describe("getOrgSeatPacks — org-owner-gated pack capacity listing", () => {
  function packsSeed() {
    return {
      customers: [
        { _id: "owner-1", email: "owner@acme.com", type: "org_admin", activatedAt: 1, organizationId: "org-1" },
      ] as Row[],
      orgs: [
        { _id: "org-1", name: "Acme", ownerCustomerId: "owner-1", createdAt: 1 },
        // A second org owned by someone else — its packs MUST NOT leak.
        { _id: "org-2", name: "Other", ownerCustomerId: "owner-2", createdAt: 1 },
      ],
      packs: [
        { _id: "pack-1", orderId: "o1", organizationId: "org-1", courseId: "course-1", totalSeats: 10, availableSeats: 7, claimedSeats: 3, validFrom: 1, createdAt: 100 },
        { _id: "pack-2", orderId: "o2", organizationId: "org-1", courseId: "course-2", totalSeats: 5, availableSeats: 5, claimedSeats: 0, validFrom: 1, createdAt: 200 },
        { _id: "pack-x", orderId: "o3", organizationId: "org-2", courseId: "course-1", totalSeats: 4, availableSeats: 4, claimedSeats: 0, validFrom: 1, createdAt: 300 },
      ],
    };
  }

  it("returns the org's packs with correct total/asignados/disponibles balances and the seatPackId", async () => {
    const { db } = makeStore(packsSeed());
    const res = await seatPacksHandler(db_ctx(db), { callerCustomerId: "owner-1", organizationId: "org-1" });

    // Only the caller-org's packs (cross-org isolation: pack-x is NOT included).
    expect(res.packs).toHaveLength(2);
    const byId = Object.fromEntries(res.packs.map((p: Record<string, unknown>) => [p.seatPackId, p]));
    expect(byId["pack-1"]).toEqual({
      seatPackId: "pack-1",
      courseId: "course-1",
      totalSeats: 10, // total
      claimedSeats: 3, // asignados
      availableSeats: 7, // disponibles
      createdAt: 100,
    });
    expect(byId["pack-2"]).toMatchObject({
      seatPackId: "pack-2",
      courseId: "course-2",
      totalSeats: 5,
      claimedSeats: 0,
      availableSeats: 5,
    });
    // Pure Access-side read: no learner identity / progress field leaks.
    const blob = JSON.stringify(res);
    expect(blob).not.toContain("progressPercent");
    expect(blob).not.toContain("pack-x");
  });

  it("REJECTS a non-owner caller (cross-org isolation)", async () => {
    const seed = packsSeed();
    seed.customers.push({ _id: "rando", email: "r@x.com", type: "individual", activatedAt: 1 });
    const { db } = makeStore(seed);
    await expect(
      seatPacksHandler(db_ctx(db), { callerCustomerId: "rando", organizationId: "org-1" })
    ).rejects.toThrow(/no autorizado/);
  });
});

describe("getOrgCourseProgress — aggregate only, never identities", () => {
  it("returns counts per course with NO learner ids/emails", async () => {
    const { db } = makeStore({
      customers: [
        { _id: "owner-1", email: "owner@acme.com", type: "org_admin", activatedAt: 1, organizationId: "org-1" },
      ],
      orgs: [{ _id: "org-1", name: "Acme", ownerCustomerId: "owner-1", createdAt: 1 }],
      packs: [
        { _id: "pack-1", orderId: "o1", organizationId: "org-1", courseId: "course-1", totalSeats: 3, availableSeats: 0, claimedSeats: 3, validFrom: 1, createdAt: 1 },
      ],
      seats: [
        { _id: "seat-1", seatPackId: "pack-1", status: "claimed", claimedBy: "l1", createdAt: 1 },
        { _id: "seat-2", seatPackId: "pack-1", status: "claimed", claimedBy: "l2", createdAt: 1 },
        { _id: "seat-3", seatPackId: "pack-1", status: "claimed", claimedBy: "l3", createdAt: 1 },
      ],
      enrollments: [
        { _id: "e1", seatId: "seat-1", learnerId: "l1", courseId: "course-1", status: "completed", progressPercent: 100, completedScoCount: 1, updatedAt: 1 },
        { _id: "e2", seatId: "seat-2", learnerId: "l2", courseId: "course-1", status: "active", progressPercent: 40, firstTouchedAt: 9, completedScoCount: 0, updatedAt: 1 },
        { _id: "e3", seatId: "seat-3", learnerId: "l3", courseId: "course-1", status: "active", progressPercent: 0, completedScoCount: 0, updatedAt: 1 },
      ],
    });
    const res = await aggregateHandler(db_ctx(db), { callerCustomerId: "owner-1", organizationId: "org-1" });
    expect(res.courses).toHaveLength(1);
    const c = res.courses[0];
    expect(c).toMatchObject({
      courseId: "course-1",
      totalClaimed: 3,
      completed: 1,
      inProgress: 1,
      notStarted: 1,
    });
    // No identities leak in the aggregate.
    expect(JSON.stringify(res)).not.toContain("l1");
    expect(JSON.stringify(res)).not.toContain("seat-1");
  });
});

// ============================================================================
// D1 — getNominalProgress (consent gate)
// ============================================================================
describe("getNominalProgress — nominal gate (Habeas Data)", () => {
  function nominalSeed(consents: Row[] = []) {
    return {
      customers: [
        { _id: "owner-1", email: "owner@acme.com", type: "org_admin", activatedAt: 1, organizationId: "org-1" },
        { _id: "learner-1", email: "emp@acme.com", type: "org_learner", organizationId: "org-1", activatedAt: 1 },
      ],
      orgs: [{ _id: "org-1", name: "Acme", ownerCustomerId: "owner-1", createdAt: 1 }],
      enrollments: [
        { _id: "e1", learnerId: "learner-1", courseId: "course-1", status: "active", progressPercent: 30, scoreRaw: 70, completedScoCount: 0, updatedAt: 1 },
      ],
      consents,
    };
  }

  it("S3.9(e) RELEASE GATE — DENIED at the function without a consent row", async () => {
    const { db } = makeStore(nominalSeed([]));
    await expect(
      nominalHandler(db_ctx(db), {
        callerCustomerId: "owner-1",
        organizationId: "org-1",
        learnerCustomerId: "learner-1",
        courseId: "course-1",
      })
    ).rejects.toThrow(/acceso denegado/);
  });

  it("DENIED when a consent row exists but granted:false (revoked)", async () => {
    const { db } = makeStore(
      nominalSeed([
        { _id: "c1", learnerCustomerId: "learner-1", organizationId: "org-1", granted: false, revokedAt: 9 },
      ])
    );
    await expect(
      nominalHandler(db_ctx(db), {
        callerCustomerId: "owner-1",
        organizationId: "org-1",
        learnerCustomerId: "learner-1",
        courseId: "course-1",
      })
    ).rejects.toThrow(/acceso denegado/);
  });

  it("ALLOWED with an org-wide granted consent (courseId undefined)", async () => {
    const { db } = makeStore(
      nominalSeed([
        { _id: "c1", learnerCustomerId: "learner-1", organizationId: "org-1", granted: true, grantedAt: 9 },
      ])
    );
    const res = await nominalHandler(db_ctx(db), {
      callerCustomerId: "owner-1",
      organizationId: "org-1",
      learnerCustomerId: "learner-1",
      courseId: "course-1",
    });
    expect(res.email).toBe("emp@acme.com");
    expect(res.enrollment?.progressPercent).toBe(30);
  });

  it("ALLOWED with a course-scoped consent matching the courseId", async () => {
    const { db } = makeStore(
      nominalSeed([
        { _id: "c1", learnerCustomerId: "learner-1", organizationId: "org-1", courseId: "course-1", granted: true, grantedAt: 9 },
      ])
    );
    const res = await nominalHandler(db_ctx(db), {
      callerCustomerId: "owner-1",
      organizationId: "org-1",
      learnerCustomerId: "learner-1",
      courseId: "course-1",
    });
    expect(res.enrollment?.scoreRaw).toBe(70);
  });

  it("DENIED when the course-scoped consent is for a DIFFERENT course", async () => {
    const { db } = makeStore(
      nominalSeed([
        { _id: "c1", learnerCustomerId: "learner-1", organizationId: "org-1", courseId: "course-OTHER", granted: true, grantedAt: 9 },
      ])
    );
    await expect(
      nominalHandler(db_ctx(db), {
        callerCustomerId: "owner-1",
        organizationId: "org-1",
        learnerCustomerId: "learner-1",
        courseId: "course-1",
      })
    ).rejects.toThrow(/acceso denegado/);
  });
});

// Helper: the handlers take a ctx with a .db; wrap the mock store's db.
function db_ctx(db: unknown) {
  return { db } as never;
}
