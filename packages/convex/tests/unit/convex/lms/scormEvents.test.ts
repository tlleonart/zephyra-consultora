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
 *
 * D02 additions:
 *  - Multi-SCO aggregation — progressPercent must equal
 *    floor(completedScoCount / totalScos × 100) on every event, sourced from
 *    course.scoStructure.
 *  - Single-SCO regression — Sprint-0 1-SCO fixture must still reach 100%.
 *  - Cross-session suspend_data hydration — per-SCO suspendData is preserved
 *    in scoStates[scoId].suspendData across mutations.
 *  - Verify-from-events invariant (Q5 lock) — replay an event sequence and
 *    confirm the denormalized completedScoCount equals the recomputed value.
 *    Source-of-truth guard against the counter ever drifting.
 *  - Top-level lessonStatus derivation — "completed" iff all SCOs completed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordScormEvent } from "../../../../convex/lms/scormEvents";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const recordHandler = (recordScormEvent as any)._handler as (
  ctx: unknown,
  args: unknown
) => Promise<unknown>;

const LEARNER_ID = "customer-1";
const COURSE_ID = "course-1";

interface MockScoState {
  lessonStatus?: string;
  scoreRaw?: number;
  suspendData?: string;
  completedAt?: number;
}

interface MockEnrollment {
  _id: string;
  learnerId: string;
  courseId: string;
  status: "active" | "completed" | "expired";
  progressPercent: number;
  completedScoCount: number;
  scoStates: Record<string, MockScoState>;
  scoreRaw?: number;
  lessonStatus?: string;
  suspendData?: string;
  firstTouchedAt?: number;
  startedAt?: number;
  updatedAt: number;
}

// scoStructure shape mirrors convex/lms/manifest.ts ParsedManifest.
// scormType defaults to "sco" when absent in the parser, so we mirror that.
interface MockCourse {
  _id: string;
  scoStructure?: {
    organizations?: {
      items?: Array<{ identifier: string; identifierref: string | null; title?: string }>;
    };
    resources?: Array<{ identifier: string; scormType?: string | null; href?: string }>;
  };
}

const buildCourse = (numScos: number): MockCourse => {
  const items = [];
  const resources = [];
  for (let i = 1; i <= numScos; i += 1) {
    const itemId = `sco-${i}`;
    const resId = `res-${i}`;
    items.push({ identifier: itemId, identifierref: resId, title: `SCO ${i}` });
    resources.push({ identifier: resId, scormType: "sco", href: `sco-${i}/index.html` });
  }
  return {
    _id: COURSE_ID,
    scoStructure: { organizations: { items }, resources },
  };
};

const buildMutationCtx = (
  initialEnrollment: MockEnrollment | null,
  course: MockCourse | null
) => {
  const enrollment: MockEnrollment | null = initialEnrollment
    ? { ...initialEnrollment, scoStates: { ...initialEnrollment.scoStates } }
    : null;
  const events: Array<Record<string, unknown>> = [];

  const db = {
    get: vi.fn().mockImplementation(async (id: string) => {
      if (enrollment && id === enrollment._id) return enrollment;
      if (course && id === course._id) return course;
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

// =============================================================================
// Single-SCO course (Sprint-0 regression)
// =============================================================================

describe("recordScormEvent — projection onto lmsEnrollments (single-SCO)", () => {
  const baseEnrollment: MockEnrollment = {
    _id: "enr-1",
    learnerId: LEARNER_ID,
    courseId: COURSE_ID,
    status: "active",
    progressPercent: 0,
    completedScoCount: 0,
    scoStates: {},
    updatedAt: 0,
  };

  it("projects lesson_status=completed to progressPercent=100 + status=completed (1-SCO)", async () => {
    const course = buildCourse(1);
    const { ctx, db, events } = buildMutationCtx(baseEnrollment, course);
    await recordHandler(ctx, {
      learnerId: LEARNER_ID,
      enrollmentId: "enr-1",
      scoId: "sco-1",
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
    expect(patchArg.completedScoCount).toBe(1);
    expect(patchArg.status).toBe("completed");
    expect(patchArg.firstTouchedAt).toBeTypeOf("number");
  });

  it("projects score.raw=3 to scoreRaw:3 as a number", async () => {
    const course = buildCourse(1);
    const { ctx, db } = buildMutationCtx(baseEnrollment, course);
    await recordHandler(ctx, {
      learnerId: LEARNER_ID,
      enrollmentId: "enr-1",
      scoId: "sco-1",
      element: "cmi.core.score.raw",
      value: "3",
    });
    const patchArg = (db.patch as ReturnType<typeof vi.fn>).mock.calls[0][1] as Partial<MockEnrollment>;
    expect(patchArg.scoreRaw).toBe(3);
  });

  it("rejects NaN scores silently (no scoreRaw on the patch)", async () => {
    const course = buildCourse(1);
    const { ctx, db } = buildMutationCtx(baseEnrollment, course);
    await recordHandler(ctx, {
      learnerId: LEARNER_ID,
      enrollmentId: "enr-1",
      scoId: "sco-1",
      element: "cmi.core.score.raw",
      value: "not-a-number",
    });
    const patchArg = (db.patch as ReturnType<typeof vi.fn>).mock.calls[0][1] as Partial<MockEnrollment>;
    expect(patchArg.scoreRaw).toBeUndefined();
  });

  it("stores suspend_data verbatim at the aggregate + per-SCO level", async () => {
    const course = buildCourse(1);
    const { ctx, db } = buildMutationCtx(baseEnrollment, course);
    await recordHandler(ctx, {
      learnerId: LEARNER_ID,
      enrollmentId: "enr-1",
      scoId: "sco-1",
      element: "cmi.suspend_data",
      value: "abc123-state-blob",
    });
    const patchArg = (db.patch as ReturnType<typeof vi.fn>).mock.calls[0][1] as Partial<MockEnrollment>;
    expect(patchArg.suspendData).toBe("abc123-state-blob");
    expect(patchArg.scoStates?.["sco-1"]?.suspendData).toBe("abc123-state-blob");
  });

  it("preserves existing firstTouchedAt on subsequent events", async () => {
    const seeded: MockEnrollment = {
      ...baseEnrollment,
      firstTouchedAt: 12345,
      startedAt: 12345,
    };
    const course = buildCourse(1);
    const { ctx, db } = buildMutationCtx(seeded, course);
    await recordHandler(ctx, {
      learnerId: LEARNER_ID,
      enrollmentId: "enr-1",
      scoId: "sco-1",
      element: "cmi.suspend_data",
      value: "state",
    });
    const patchArg = (db.patch as ReturnType<typeof vi.fn>).mock.calls[0][1] as Partial<MockEnrollment>;
    expect(patchArg.firstTouchedAt).toBeUndefined();
    expect(patchArg.startedAt).toBeUndefined();
  });

  it("throws a clear error when the enrollment is missing", async () => {
    const { ctx } = buildMutationCtx(null, buildCourse(1));
    await expect(
      recordHandler(ctx, {
        learnerId: LEARNER_ID,
        enrollmentId: "nope",
        scoId: "sco-1",
        element: "cmi.core.lesson_status",
        value: "completed",
      })
    ).rejects.toThrow(/enrollment not found/);
  });

  it("rejects when the enrollment belongs to a different learner", async () => {
    const { ctx } = buildMutationCtx(
      { ...baseEnrollment, learnerId: "customer-OTHER" },
      buildCourse(1)
    );
    await expect(
      recordHandler(ctx, {
        learnerId: LEARNER_ID,
        enrollmentId: "enr-1",
        scoId: "sco-1",
        element: "cmi.core.lesson_status",
        value: "completed",
      })
    ).rejects.toThrow(/does not belong to learner/);
  });
});

// =============================================================================
// D02 — Multi-SCO aggregation
// =============================================================================

describe("recordScormEvent — multi-SCO aggregation (D02)", () => {
  const baseEnrollment = (): MockEnrollment => ({
    _id: "enr-1",
    learnerId: LEARNER_ID,
    courseId: COURSE_ID,
    status: "active",
    progressPercent: 0,
    completedScoCount: 0,
    scoStates: {},
    updatedAt: 0,
  });

  it("progressPercent = 33 after completing sco-1 of a 3-SCO course", async () => {
    const course = buildCourse(3);
    const { ctx, enrollment } = buildMutationCtx(baseEnrollment(), course);
    await recordHandler(ctx, {
      learnerId: LEARNER_ID,
      enrollmentId: "enr-1",
      scoId: "sco-1",
      element: "cmi.core.lesson_status",
      value: "completed",
    });
    expect(enrollment?.completedScoCount).toBe(1);
    expect(enrollment?.progressPercent).toBe(33);
    expect(enrollment?.lessonStatus).toBe("incomplete");
    // Enrollment must NOT be promoted to "completed" while SCOs remain open.
    expect(enrollment?.status).toBe("active");
  });

  it("progressPercent = 66 after completing two of three SCOs", async () => {
    const course = buildCourse(3);
    const { ctx, enrollment } = buildMutationCtx(baseEnrollment(), course);
    await recordHandler(ctx, {
      learnerId: LEARNER_ID,
      enrollmentId: "enr-1",
      scoId: "sco-1",
      element: "cmi.core.lesson_status",
      value: "completed",
    });
    await recordHandler(ctx, {
      learnerId: LEARNER_ID,
      enrollmentId: "enr-1",
      scoId: "sco-2",
      element: "cmi.core.lesson_status",
      value: "completed",
    });
    expect(enrollment?.completedScoCount).toBe(2);
    expect(enrollment?.progressPercent).toBe(66);
    expect(enrollment?.lessonStatus).toBe("incomplete");
    expect(enrollment?.status).toBe("active");
  });

  it("progressPercent = 100 + aggregate lessonStatus=completed once every SCO completes", async () => {
    const course = buildCourse(3);
    const { ctx, enrollment } = buildMutationCtx(baseEnrollment(), course);
    for (const sco of ["sco-1", "sco-2", "sco-3"]) {
      await recordHandler(ctx, {
        learnerId: LEARNER_ID,
        enrollmentId: "enr-1",
        scoId: sco,
        element: "cmi.core.lesson_status",
        value: "completed",
      });
    }
    expect(enrollment?.completedScoCount).toBe(3);
    expect(enrollment?.progressPercent).toBe(100);
    expect(enrollment?.lessonStatus).toBe("completed");
    expect(enrollment?.status).toBe("completed");
  });

  it("per-SCO suspendData is preserved across mutations (cross-session resume input)", async () => {
    const course = buildCourse(2);
    const { ctx, enrollment } = buildMutationCtx(baseEnrollment(), course);
    await recordHandler(ctx, {
      learnerId: LEARNER_ID,
      enrollmentId: "enr-1",
      scoId: "sco-1",
      element: "cmi.suspend_data",
      value: "sco1-state-blob",
    });
    expect(enrollment?.scoStates["sco-1"]?.suspendData).toBe("sco1-state-blob");
    // Writing a different element on sco-2 must NOT clobber sco-1's suspend data.
    await recordHandler(ctx, {
      learnerId: LEARNER_ID,
      enrollmentId: "enr-1",
      scoId: "sco-2",
      element: "cmi.core.lesson_status",
      value: "incomplete",
    });
    expect(enrollment?.scoStates["sco-1"]?.suspendData).toBe("sco1-state-blob");
    // Aggregate suspendData mirrors the LATEST touched (sco-2 wrote
    // lesson_status, not suspend_data, so aggregate suspendData stays from
    // the earlier sco-1 write).
    expect(enrollment?.suspendData).toBe("sco1-state-blob");
  });

  it("Q5 invariant — verify-from-events: completedScoCount == count(scoStates where status terminal)", async () => {
    // Replay an event sequence and recompute the expected counter from the
    // events. The denormalized completedScoCount on the row MUST match the
    // recomputation. This is the source-of-truth guard the Q5 lock describes.
    const course = buildCourse(3);
    const { ctx, enrollment } = buildMutationCtx(baseEnrollment(), course);

    const eventSeq: Array<{ scoId: string; element: string; value: string }> = [
      { scoId: "sco-1", element: "cmi.core.lesson_status", value: "incomplete" },
      { scoId: "sco-1", element: "cmi.suspend_data", value: "state-1-mid" },
      { scoId: "sco-1", element: "cmi.core.lesson_status", value: "completed" },
      { scoId: "sco-2", element: "cmi.core.lesson_status", value: "incomplete" },
      { scoId: "sco-3", element: "cmi.core.lesson_status", value: "passed" },
    ];
    for (const ev of eventSeq) {
      await recordHandler(ctx, {
        learnerId: LEARNER_ID,
        enrollmentId: "enr-1",
        ...ev,
      });
    }

    // Replay-from-scratch: walk every event ourselves and compute the
    // expected per-SCO terminal map.
    const replay: Record<string, string | undefined> = {};
    for (const ev of eventSeq) {
      if (ev.element === "cmi.core.lesson_status") replay[ev.scoId] = ev.value;
    }
    const expectedCompleted = Object.values(replay).filter(
      (s) => s === "completed" || s === "passed"
    ).length;

    expect(enrollment?.completedScoCount).toBe(expectedCompleted);
    // And the per-SCO state map's terminal entries match what we replayed.
    const observedCompleted = Object.keys(enrollment?.scoStates ?? {}).filter(
      (k) => {
        const s = enrollment!.scoStates[k]?.lessonStatus;
        return s === "completed" || s === "passed";
      }
    ).length;
    expect(observedCompleted).toBe(expectedCompleted);
  });

  it("aggregate lessonStatus = 'passed' when every SCO is at least passed but not all completed", async () => {
    const course = buildCourse(2);
    const { ctx, enrollment } = buildMutationCtx(baseEnrollment(), course);
    await recordHandler(ctx, {
      learnerId: LEARNER_ID,
      enrollmentId: "enr-1",
      scoId: "sco-1",
      element: "cmi.core.lesson_status",
      value: "completed",
    });
    await recordHandler(ctx, {
      learnerId: LEARNER_ID,
      enrollmentId: "enr-1",
      scoId: "sco-2",
      element: "cmi.core.lesson_status",
      value: "passed",
    });
    // Both terminal-positive but not both "completed" → "passed".
    expect(enrollment?.lessonStatus).toBe("passed");
    expect(enrollment?.completedScoCount).toBe(2);
    expect(enrollment?.progressPercent).toBe(100);
    // Status promoted because all SCOs reached a positive terminal state.
    expect(enrollment?.status).toBe("completed");
  });

  it("rapid-succession events for two SCOs aggregate correctly (single-handler serialization)", async () => {
    // Convex mutations are single-threaded per row by Convex semantics — a
    // real client cannot interleave two recordScormEvent calls against the
    // same enrollment. This test proves the handler logic accumulates
    // correctly when called back-to-back (the only mode a real client can
    // produce). The Q5 lock in the PDD documents that race protection comes
    // from this serialization PLUS the in-transaction recompute.
    const course = buildCourse(2);
    const { ctx, enrollment } = buildMutationCtx(baseEnrollment(), course);
    await recordHandler(ctx, {
      learnerId: LEARNER_ID,
      enrollmentId: "enr-1",
      scoId: "sco-1",
      element: "cmi.core.lesson_status",
      value: "completed",
    });
    await recordHandler(ctx, {
      learnerId: LEARNER_ID,
      enrollmentId: "enr-1",
      scoId: "sco-2",
      element: "cmi.core.lesson_status",
      value: "completed",
    });
    expect(enrollment?.completedScoCount).toBe(2);
    expect(enrollment?.progressPercent).toBe(100);
    expect(enrollment?.lessonStatus).toBe("completed");
  });
});
