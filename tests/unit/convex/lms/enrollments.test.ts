/**
 * Unit tests for convex/lms/enrollments.ts.
 *
 * Why these specific cases:
 *  - issueEnrollment happy path — the canonical D01 success: admin issues
 *    access to a known learner, a new active row is inserted.
 *  - issueEnrollment idempotency — double-click safety. Admins WILL re-click
 *    "Otorgar" out of habit; we must not pile up duplicate active rows.
 *  - issueEnrollment learner-not-found — admins cannot pre-create lmsCustomers
 *    rows (PDD §7.5 H-2 mitigation); the learner must self-activate first.
 *  - issueEnrollment unauthenticated — regression guard if requireAuth is
 *    ever stripped from the mutation.
 *  - getMyEnrollment happy path + null — the access gate the player page
 *    depends on. The null branch is what renders "no tenés acceso".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  issueEnrollment,
  getMyEnrollment,
} from "../../../../convex/lms/enrollments";
import { AuthError } from "../../../../convex/model/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const issueHandler = (issueEnrollment as any)._handler as (
  ctx: unknown,
  args: unknown
) => Promise<{
  enrollmentId: string;
  customer: { _id: string; email: string };
  alreadyEnrolled: boolean;
}>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getMyHandler = (getMyEnrollment as any)._handler as (
  ctx: unknown,
  args: unknown
) => Promise<Record<string, unknown> | null>;

interface MockCustomer {
  _id: string;
  email: string;
  type: "individual" | "org_admin" | "org_learner";
  createdAt: number;
  deletedAt?: number;
}

interface MockEnrollment {
  _id: string;
  learnerId: string;
  courseId: string;
  status: "active" | "completed" | "expired";
  progressPercent: number;
  updatedAt: number;
}

interface MockCourse {
  _id: string;
  title: string;
  deletedAt?: number;
}

interface MockAdmin {
  _id: string;
  role: "admin" | "superadmin";
  isActive: boolean;
  deletedAt?: number;
}

const buildCtx = (opts: {
  admin?: MockAdmin | null;
  course?: MockCourse | null;
  customer?: MockCustomer | null;
  existingEnrollment?: MockEnrollment | null;
  allEnrollmentsByLearner?: MockEnrollment[];
}) => {
  const enrollmentsInserted: Array<Record<string, unknown>> = [];

  const customerQuery = {
    withIndex: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(opts.customer ?? null),
  };
  const enrollmentByLcsQuery = {
    withIndex: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(opts.existingEnrollment ?? null),
  };
  const enrollmentByLearnerQuery = {
    withIndex: vi.fn().mockReturnThis(),
    collect: vi.fn().mockResolvedValue(opts.allEnrollmentsByLearner ?? []),
  };

  const db = {
    get: vi.fn().mockImplementation(async (id: string) => {
      if (opts.admin && id === opts.admin._id) return opts.admin;
      if (opts.course && id === opts.course._id) return opts.course;
      return null;
    }),
    query: vi.fn().mockImplementation((table: string) => {
      if (table === "lmsCustomers") return customerQuery;
      if (table === "lmsEnrollments") {
        // issueEnrollment calls .withIndex("by_learner_course_status"); the
        // future listMyEnrollments path calls .withIndex("by_learner"). The
        // returned chainable already covers both; we route based on which
        // terminal method is invoked (first vs collect).
        return {
          withIndex: vi.fn().mockImplementation((name: string) => {
            if (name === "by_learner") return enrollmentByLearnerQuery;
            return enrollmentByLcsQuery;
          }),
        };
      }
      return { withIndex: vi.fn().mockReturnThis(), first: vi.fn().mockResolvedValue(null) };
    }),
    insert: vi.fn().mockImplementation(async (table: string, row: Record<string, unknown>) => {
      if (table === "lmsEnrollments") enrollmentsInserted.push(row);
      return `lmsEnrollments-${enrollmentsInserted.length}`;
    }),
  };

  return { ctx: { db }, db, enrollmentsInserted, customerQuery, enrollmentByLcsQuery };
};

const ADMIN: MockAdmin = {
  _id: "admin-1",
  role: "admin",
  isActive: true,
};

const COURSE: MockCourse = {
  _id: "course-1",
  title: "Curso D01",
};

const CUSTOMER: MockCustomer = {
  _id: "customer-1",
  email: "learner@example.com",
  type: "individual",
  createdAt: 1,
};

beforeEach(() => vi.clearAllMocks());

describe("issueEnrollment", () => {
  it("happy path: inserts a fresh active enrollment", async () => {
    const { ctx, db, enrollmentsInserted } = buildCtx({
      admin: ADMIN,
      course: COURSE,
      customer: CUSTOMER,
      existingEnrollment: null,
    });
    const result = await issueHandler(ctx, {
      userId: ADMIN._id,
      courseId: COURSE._id,
      learnerEmail: "learner@example.com",
    });
    expect(result.alreadyEnrolled).toBe(false);
    expect(result.customer.email).toBe("learner@example.com");
    expect(enrollmentsInserted).toHaveLength(1);
    expect(enrollmentsInserted[0]).toMatchObject({
      learnerId: "customer-1",
      courseId: "course-1",
      status: "active",
      progressPercent: 0,
      // D02: per-SCO counters start zeroed; totalScos is NOT denormalized here
      // — the course row is the source of truth and is dereferenced inside
      // recordScormEvent.
      completedScoCount: 0,
    });
    expect(enrollmentsInserted[0].scoStates).toEqual({});
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it("normalizes the email before lookup (trim + lowercase)", async () => {
    const { ctx, customerQuery } = buildCtx({
      admin: ADMIN,
      course: COURSE,
      customer: CUSTOMER,
    });
    await issueHandler(ctx, {
      userId: ADMIN._id,
      courseId: COURSE._id,
      learnerEmail: "  Learner@Example.com  ",
    });
    // withIndex was called with a builder; the builder's eq("email", ...) is
    // the normalization signal. We assert on the resulting first() call by
    // re-invoking the builder shape through the spy.
    expect(customerQuery.withIndex).toHaveBeenCalled();
    const builderFn = (customerQuery.withIndex as ReturnType<typeof vi.fn>).mock.calls[0][1] as (
      q: { eq: (field: string, value: string) => unknown }
    ) => unknown;
    const eqSpy = vi.fn();
    builderFn({ eq: eqSpy });
    expect(eqSpy).toHaveBeenCalledWith("email", "learner@example.com");
  });

  it("idempotent: returns the existing active enrollment on a second call", async () => {
    const existing: MockEnrollment = {
      _id: "enr-existing",
      learnerId: "customer-1",
      courseId: "course-1",
      status: "active",
      progressPercent: 0,
      updatedAt: 1,
    };
    const { ctx, db, enrollmentsInserted } = buildCtx({
      admin: ADMIN,
      course: COURSE,
      customer: CUSTOMER,
      existingEnrollment: existing,
    });
    const result = await issueHandler(ctx, {
      userId: ADMIN._id,
      courseId: COURSE._id,
      learnerEmail: "learner@example.com",
    });
    expect(result.alreadyEnrolled).toBe(true);
    expect(result.enrollmentId).toBe("enr-existing");
    expect(enrollmentsInserted).toHaveLength(0);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("throws AuthError when the learner email is not a known customer", async () => {
    const { ctx } = buildCtx({
      admin: ADMIN,
      course: COURSE,
      customer: null,
    });
    await expect(
      issueHandler(ctx, {
        userId: ADMIN._id,
        courseId: COURSE._id,
        learnerEmail: "unknown@example.com",
      })
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("throws AuthError when the course is missing", async () => {
    const { ctx } = buildCtx({
      admin: ADMIN,
      course: null,
      customer: CUSTOMER,
    });
    await expect(
      issueHandler(ctx, {
        userId: ADMIN._id,
        courseId: "course-missing",
        learnerEmail: "learner@example.com",
      })
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("throws AuthError when the caller is unauthenticated", async () => {
    const { ctx } = buildCtx({
      admin: null,
      course: COURSE,
      customer: CUSTOMER,
    });
    await expect(
      issueHandler(ctx, {
        userId: "ghost",
        courseId: COURSE._id,
        learnerEmail: "learner@example.com",
      })
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("treats a soft-deleted customer as not found", async () => {
    const { ctx } = buildCtx({
      admin: ADMIN,
      course: COURSE,
      customer: { ...CUSTOMER, deletedAt: 1234 },
    });
    await expect(
      issueHandler(ctx, {
        userId: ADMIN._id,
        courseId: COURSE._id,
        learnerEmail: "learner@example.com",
      })
    ).rejects.toBeInstanceOf(AuthError);
  });
});

describe("getMyEnrollment", () => {
  it("returns the active enrollment when present", async () => {
    const existing: MockEnrollment = {
      _id: "enr-1",
      learnerId: "customer-1",
      courseId: "course-1",
      status: "active",
      progressPercent: 42,
      updatedAt: 1,
    };
    const { ctx } = buildCtx({ existingEnrollment: existing });
    const result = await getMyHandler(ctx, {
      learnerId: "customer-1",
      courseId: "course-1",
    });
    expect(result).not.toBeNull();
    expect((result as unknown as MockEnrollment).progressPercent).toBe(42);
  });

  it("returns null when there is no enrollment (the access-gate signal)", async () => {
    const { ctx } = buildCtx({ existingEnrollment: null });
    const result = await getMyHandler(ctx, {
      learnerId: "customer-1",
      courseId: "course-1",
    });
    expect(result).toBeNull();
  });
});
