/**
 * Unit tests for convex/lms/scormEvents.ts.
 *
 * Why these specific cases:
 *  - recordScormEvent projection — the demo loop's progress bar depends on
 *    progressFromStatus running on every lesson_status write. If the switch
 *    branches silently drop, the spike loses its centerpiece signal.
 *  - score.raw coercion — content sends strings; the aggregate must store
 *    numbers (filtered against NaN).
 *  - Ownership cross-check — D01 retyped learnerId to Id<"lmsCustomers">.
 *    recordScormEvent now refuses if the enrollment row's learnerId doesn't
 *    match the arg (defense in depth against a forged learnerId reaching
 *    the mutation directly).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordScormEvent } from "../../../../convex/lms/scormEvents";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const recordHandler = (recordScormEvent as any)._handler as (
  ctx: unknown,
  args: unknown
) => Promise<unknown>;

const LEARNER_ID = "customer-1";

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

const buildMutationCtx = (initialEnrollment: MockEnrollment | null) => {
  const enrollment: MockEnrollment | null = initialEnrollment
    ? { ...initialEnrollment }
    : null;
  const events: Array<Record<string, unknown>> = [];

  const db = {
    get: vi.fn().mockImplementation(async (id: string) => {
      if (enrollment && id === enrollment._id) return enrollment;
      return null;
    }),
    insert: vi.fn().mockImplementation(async (table: string, row: Record<string, unknown>) => {
      if (table === "lmsScormEvents") events.push(row);
      return `${table}-${(events.length).toString()}`;
    }),
    patch: vi.fn().mockImplementation(async (id: string, patch: Partial<MockEnrollment>) => {
      if (enrollment && enrollment._id === id) {
        Object.assign(enrollment, patch);
      }
    }),
  };

  return { ctx: { db }, db, events, enrollment };
};

beforeEach(() => vi.clearAllMocks());

describe("recordScormEvent — projection onto lmsEnrollments", () => {
  const baseEnrollment: MockEnrollment = {
    _id: "enr-1",
    learnerId: LEARNER_ID,
    courseId: "course-1",
    status: "active",
    progressPercent: 0,
    updatedAt: 0,
  };

  it("projects lesson_status=completed to progressPercent=100 + status=completed", async () => {
    const { ctx, db, events } = buildMutationCtx(baseEnrollment);
    await recordHandler(ctx, {
      learnerId: LEARNER_ID,
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
      learnerId: LEARNER_ID,
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
      learnerId: LEARNER_ID,
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
      learnerId: LEARNER_ID,
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
      learnerId: LEARNER_ID,
      enrollmentId: "enr-1",
      element: "cmi.suspend_data",
      value: "state",
    });
    const patchArg = (db.patch as ReturnType<typeof vi.fn>).mock.calls[0][1] as Partial<MockEnrollment>;
    expect(patchArg.firstTouchedAt).toBeUndefined();
    expect(patchArg.startedAt).toBeUndefined();
  });

  it("throws a clear error when the enrollment is missing", async () => {
    const { ctx } = buildMutationCtx(null);
    await expect(
      recordHandler(ctx, {
        learnerId: LEARNER_ID,
        enrollmentId: "nope",
        element: "cmi.core.lesson_status",
        value: "completed",
      })
    ).rejects.toThrow(/enrollment not found/);
  });

  it("rejects when the enrollment belongs to a different learner", async () => {
    const { ctx } = buildMutationCtx({
      ...baseEnrollment,
      learnerId: "customer-OTHER",
    });
    await expect(
      recordHandler(ctx, {
        learnerId: LEARNER_ID,
        enrollmentId: "enr-1",
        element: "cmi.core.lesson_status",
        value: "completed",
      })
    ).rejects.toThrow(/does not belong to learner/);
  });
});
