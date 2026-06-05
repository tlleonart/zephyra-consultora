/**
 * Unit tests for convex/lms/scormEvents.ts.
 *
 * Why these specific cases:
 *  - recordScormEvent projection — the demo loop's progress bar depends on
 *    progressFromStatus running on every lesson_status write. If the switch
 *    branches silently drop, the spike loses its centerpiece signal.
 *  - score.raw coercion — content sends strings; the aggregate must store
 *    numbers (filtered against NaN).
 *  - ensureSpikeEnrollment idempotency — Sprint-0 R3 (claim races) lives
 *    here in miniature: two calls with the same args must return the same
 *    row id, never a duplicate.
 *  - Admin gate — B02 inserted requireAuth across every public function;
 *    this is the regression guard if someone strips the gate.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  recordScormEvent,
  ensureSpikeEnrollment,
} from "../../../../convex/lms/scormEvents";
import { AuthError } from "../../../../convex/model/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const recordHandler = (recordScormEvent as any)._handler as (
  ctx: unknown,
  args: unknown
) => Promise<unknown>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ensureHandler = (ensureSpikeEnrollment as any)._handler as (
  ctx: unknown,
  args: unknown
) => Promise<unknown>;

const adminUser = {
  _id: "user-1",
  email: "admin@zephyra.test",
  role: "admin" as const,
  isActive: true,
};

interface MockEnrollment {
  _id: string;
  learnerId: string;
  courseId: string;
  status: "active" | "completed" | "expired";
  progressPercent: number;
  scoreRaw?: number;
  lessonStatus?: string;
  suspendData?: string;
  firstTouchedAt?: number;
  startedAt?: number;
  updatedAt: number;
}

const buildMutationCtx = (
  initialEnrollment: MockEnrollment | null,
  options: { user?: unknown } = {}
) => {
  // Single-row mock store: enough for projection + idempotency tests.
  const enrollment: MockEnrollment | null = initialEnrollment
    ? { ...initialEnrollment }
    : null;
  const events: Array<Record<string, unknown>> = [];
  const enrollmentInserts: Array<Record<string, unknown>> = [];

  const queryStub = {
    withIndex: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(enrollment),
  };

  const db = {
    get: vi.fn().mockImplementation(async (id: string) => {
      if (enrollment && enrollment._id === id) return enrollment;
      if (options.user && id === (options.user as { _id: string })._id) {
        return options.user;
      }
      return null;
    }),
    query: vi.fn().mockImplementation((table: string) => {
      if (table === "lmsEnrollments") return queryStub;
      return { withIndex: vi.fn().mockReturnThis(), first: vi.fn().mockResolvedValue(null) };
    }),
    insert: vi.fn().mockImplementation(async (table: string, row: Record<string, unknown>) => {
      if (table === "lmsScormEvents") events.push(row);
      if (table === "lmsEnrollments") enrollmentInserts.push(row);
      return `${table}-${(events.length + enrollmentInserts.length).toString()}`;
    }),
    patch: vi.fn().mockImplementation(async (id: string, patch: Partial<MockEnrollment>) => {
      if (enrollment && enrollment._id === id) {
        Object.assign(enrollment, patch);
      }
    }),
  };

  // Override db.get behavior: requireAuth calls ctx.db.get(userId). We need
  // it to return the admin user when called with the userId, the enrollment
  // when called with the enrollment id.
  db.get = vi.fn().mockImplementation(async (id: string) => {
    if (options.user !== undefined) {
      const u = options.user as { _id: string } | null;
      if (u && id === u._id) return u;
    } else if (id === adminUser._id) {
      return adminUser;
    }
    if (enrollment && id === enrollment._id) return enrollment;
    return null;
  });

  return { ctx: { db }, db, events, enrollment, enrollmentInserts, queryStub };
};

beforeEach(() => vi.clearAllMocks());

describe("recordScormEvent — projection onto lmsEnrollments", () => {
  const baseEnrollment: MockEnrollment = {
    _id: "enr-1",
    learnerId: "spike-learner",
    courseId: "course-1",
    status: "active",
    progressPercent: 0,
    updatedAt: 0,
  };

  it("projects lesson_status=completed to progressPercent=100 + status=completed", async () => {
    const { ctx, db, events } = buildMutationCtx(baseEnrollment);
    await recordHandler(ctx, {
      userId: adminUser._id,
      enrollmentId: "enr-1",
      element: "cmi.core.lesson_status",
      value: "completed",
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      element: "cmi.core.lesson_status",
      value: "completed",
    });
    expect(db.patch).toHaveBeenCalledTimes(1);
    const patchArg = (db.patch as ReturnType<typeof vi.fn>).mock.calls[0][1] as Partial<MockEnrollment>;
    expect(patchArg.lessonStatus).toBe("completed");
    expect(patchArg.progressPercent).toBe(100);
    expect(patchArg.status).toBe("completed");
    expect(patchArg.firstTouchedAt).toBeTypeOf("number");
  });

  it("projects score.raw=3 to scoreRaw:3 as a number", async () => {
    const { ctx, db } = buildMutationCtx(baseEnrollment);
    await recordHandler(ctx, {
      userId: adminUser._id,
      enrollmentId: "enr-1",
      element: "cmi.core.score.raw",
      value: "3",
    });
    const patchArg = (db.patch as ReturnType<typeof vi.fn>).mock.calls[0][1] as Partial<MockEnrollment>;
    expect(patchArg.scoreRaw).toBe(3);
  });

  it("rejects NaN scores silently (no scoreRaw on the patch)", async () => {
    const { ctx, db } = buildMutationCtx(baseEnrollment);
    await recordHandler(ctx, {
      userId: adminUser._id,
      enrollmentId: "enr-1",
      element: "cmi.core.score.raw",
      value: "not-a-number",
    });
    const patchArg = (db.patch as ReturnType<typeof vi.fn>).mock.calls[0][1] as Partial<MockEnrollment>;
    expect(patchArg.scoreRaw).toBeUndefined();
  });

  it("stores suspend_data verbatim", async () => {
    const { ctx, db } = buildMutationCtx(baseEnrollment);
    await recordHandler(ctx, {
      userId: adminUser._id,
      enrollmentId: "enr-1",
      element: "cmi.suspend_data",
      value: "abc123-state-blob",
    });
    const patchArg = (db.patch as ReturnType<typeof vi.fn>).mock.calls[0][1] as Partial<MockEnrollment>;
    expect(patchArg.suspendData).toBe("abc123-state-blob");
  });

  it("preserves existing firstTouchedAt on subsequent events", async () => {
    const seeded: MockEnrollment = {
      ...baseEnrollment,
      firstTouchedAt: 12345,
      startedAt: 12345,
    };
    const { ctx, db } = buildMutationCtx(seeded);
    await recordHandler(ctx, {
      userId: adminUser._id,
      enrollmentId: "enr-1",
      element: "cmi.suspend_data",
      value: "state",
    });
    const patchArg = (db.patch as ReturnType<typeof vi.fn>).mock.calls[0][1] as Partial<MockEnrollment>;
    expect(patchArg.firstTouchedAt).toBeUndefined();
    expect(patchArg.startedAt).toBeUndefined();
  });

  it("throws AuthError when the userId is unauthenticated", async () => {
    const { ctx } = buildMutationCtx(baseEnrollment, { user: null });
    await expect(
      recordHandler(ctx, {
        userId: "ghost",
        enrollmentId: "enr-1",
        element: "cmi.core.lesson_status",
        value: "completed",
      })
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("throws a clear error when the enrollment is missing", async () => {
    const { ctx } = buildMutationCtx(null);
    await expect(
      recordHandler(ctx, {
        userId: adminUser._id,
        enrollmentId: "nope",
        element: "cmi.core.lesson_status",
        value: "completed",
      })
    ).rejects.toThrow(/enrollment not found/);
  });
});

describe("ensureSpikeEnrollment — idempotency (R3 mitigation)", () => {
  it("inserts a fresh row when no spike enrollment exists", async () => {
    const { ctx, db, enrollmentInserts } = buildMutationCtx(null);
    const result = await ensureHandler(ctx, {
      userId: adminUser._id,
      courseId: "course-1",
    });
    expect(db.insert).toHaveBeenCalledWith(
      "lmsEnrollments",
      expect.objectContaining({
        learnerId: "spike-learner",
        courseId: "course-1",
        status: "active",
        progressPercent: 0,
      })
    );
    expect(enrollmentInserts).toHaveLength(1);
    expect(result).toMatch(/^lmsEnrollments-/);
  });

  it("returns the existing row id when called a second time (no duplicate insert)", async () => {
    const seeded: MockEnrollment = {
      _id: "enr-spike-existing",
      learnerId: "spike-learner",
      courseId: "course-1",
      status: "active",
      progressPercent: 0,
      updatedAt: 0,
    };
    const { ctx, db } = buildMutationCtx(seeded);
    const result = await ensureHandler(ctx, {
      userId: adminUser._id,
      courseId: "course-1",
    });
    expect(result).toBe("enr-spike-existing");
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated callers", async () => {
    const { ctx } = buildMutationCtx(null, { user: null });
    await expect(
      ensureHandler(ctx, {
        userId: "ghost",
        courseId: "course-1",
      })
    ).rejects.toBeInstanceOf(AuthError);
  });
});
