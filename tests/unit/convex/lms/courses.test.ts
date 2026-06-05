/**
 * Unit tests for convex/lms/courses.ts — ingestScormPackage action & insertCourse internal mutation.
 *
 * Why hand-rolled mocks and not convex-test:
 *   convex-test requires convex ^1.32, but this repo pins convex ^1.17.4.
 *   Forcing an upgrade is out of scope for B04 (would risk Sprint-1 surface
 *   area); a thin mock is sufficient for the projection contract we care
 *   about (admin gate + manifest parse delegation + insert payload shape).
 *
 * We unwrap the Convex-wrapped handler via the `_handler` symbol that
 * convex/server attaches at registration time (see
 * node_modules/convex/dist/cjs/server/impl/registration_impl.js). This is
 * the same seam convex-test uses internally; it is stable across 1.17.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ingestScormPackage, insertCourse } from "../../../../convex/lms/courses";
import { AuthError } from "../../../../convex/model/auth";

// Unwrap the registered handler. The Convex action/mutation wrapper stamps
// the raw handler at `_handler`; bypass the runtime so we can invoke with
// a synthetic ctx instead of dispatching through the Convex backend.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ingestHandler = (ingestScormPackage as any)._handler as (
  ctx: unknown,
  args: unknown
) => Promise<unknown>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const insertHandler = (insertCourse as any)._handler as (
  ctx: unknown,
  args: unknown
) => Promise<unknown>;

const adminUser = {
  _id: "user-1",
  email: "admin@zephyra.test",
  role: "admin" as const,
  isActive: true,
};

const minimalManifestXml = `<manifest>
  <organizations>
    <organization identifier="ORG">
      <title>Test Course</title>
      <item identifier="I1" identifierref="R1"><title>Lesson 1</title></item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="R1" adlcp:scormtype="sco" href="index.html"/>
  </resources>
</manifest>`;

const buildActionCtx = (overrides: Partial<{
  user: unknown;
  manifestText: string;
  runMutationResult: { courseId: string; slug: string };
}> = {}) => {
  const runQuery = vi.fn().mockResolvedValue(
    overrides.user === undefined ? adminUser : overrides.user
  );
  const runMutation = vi.fn().mockResolvedValue(
    overrides.runMutationResult ?? { courseId: "course-1", slug: "test-course" }
  );
  const storageGet = vi.fn().mockResolvedValue({
    text: async () => overrides.manifestText ?? minimalManifestXml,
  });
  return {
    ctx: {
      runQuery,
      runMutation,
      storage: { get: storageGet },
    },
    spies: { runQuery, runMutation, storageGet },
  };
};

describe("ingestScormPackage action — auth gate", () => {
  it("throws AuthError when getCurrentUser returns null", async () => {
    const { ctx } = buildActionCtx({ user: null });
    await expect(
      ingestHandler(ctx, {
        userId: "user-1",
        campusCourseId: "C-1",
        files: [{ path: "imsmanifest.xml", storageId: "store-1" }],
      })
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("throws AuthError when the user has a non-admin role", async () => {
    const { ctx } = buildActionCtx({
      user: { ...adminUser, role: "viewer" },
    });
    await expect(
      ingestHandler(ctx, {
        userId: "user-1",
        campusCourseId: "C-1",
        files: [{ path: "imsmanifest.xml", storageId: "store-1" }],
      })
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("permits superadmin (PDD parity with admin)", async () => {
    const { ctx } = buildActionCtx({
      user: { ...adminUser, role: "superadmin" },
    });
    const result = (await ingestHandler(ctx, {
      userId: "user-1",
      campusCourseId: "C-1",
      files: [{ path: "imsmanifest.xml", storageId: "store-1" }],
    })) as { slug: string };
    expect(result.slug).toBe("test-course");
  });
});

describe("ingestScormPackage action — manifest pipeline", () => {
  it("locates imsmanifest.xml, parses it, and delegates to insertCourse", async () => {
    const { ctx, spies } = buildActionCtx();
    const result = (await ingestHandler(ctx, {
      userId: "user-1",
      campusCourseId: "CAMPUS-42",
      files: [
        { path: "imsmanifest.xml", storageId: "store-manifest" },
        { path: "index.html", storageId: "store-index" },
      ],
    })) as {
      courseId: string;
      slug: string;
      title: string;
      entryPoint: string | null;
      fileCount: number;
      parseMs: number;
    };

    expect(spies.runMutation).toHaveBeenCalledTimes(1);
    const [, mutationArgs] = spies.runMutation.mock.calls[0];
    expect(mutationArgs).toMatchObject({
      campusCourseId: "CAMPUS-42",
      title: "Test Course",
      manifest: minimalManifestXml,
      entryPoint: "index.html",
    });
    expect(result.entryPoint).toBe("index.html");
    expect(result.fileCount).toBe(2);
  });

  it("throws when no imsmanifest.xml is present in the file map", async () => {
    const { ctx } = buildActionCtx();
    await expect(
      ingestHandler(ctx, {
        userId: "user-1",
        campusCourseId: "C-1",
        files: [{ path: "index.html", storageId: "x" }],
      })
    ).rejects.toThrow(/imsmanifest\.xml not found/);
  });

  it("uses the args.title override when provided, falling back to manifest title", async () => {
    const { ctx, spies } = buildActionCtx();
    await ingestHandler(ctx, {
      userId: "user-1",
      campusCourseId: "C-1",
      title: "Custom Title",
      files: [{ path: "imsmanifest.xml", storageId: "store-1" }],
    });
    const [, mutationArgs] = spies.runMutation.mock.calls[0];
    expect((mutationArgs as { title: string }).title).toBe("Custom Title");
  });
});

// --- insertCourse internalMutation -----------------------------------------
//
// NOTE on the spec line "duplicate campusCourseId archives old + inserts new":
// the current implementation (Sprint 1 B-merge) DOES NOT archive on collision.
// It resolves slug uniqueness by suffixing the campusCourseId last-6 — a
// brand-new draft row is inserted alongside the existing one. We test the
// real behavior; the archive-old semantic is a deferred enhancement
// (tracked in the code-change report; see notes).

const buildMutationCtx = (overrides: Partial<{
  existingSlugRow: unknown;
}> = {}) => {
  const inserts: Array<{ table: string; row: unknown }> = [];
  const db = {
    query: vi.fn().mockImplementation(() => ({
      withIndex: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(overrides.existingSlugRow ?? null),
    })),
    insert: vi.fn().mockImplementation(async (table: string, row: unknown) => {
      inserts.push({ table, row });
      return `${table}-${inserts.length}`;
    }),
  };
  return { ctx: { db }, db, inserts };
};

describe("insertCourse internal mutation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("slugifies the title and inserts a draft course row", async () => {
    const { ctx, inserts } = buildMutationCtx();
    const result = (await insertHandler(ctx, {
      campusCourseId: "CAMPUS-001",
      title: "Diversidad, Equidad e Inclusión",
      scoFiles: { "index.html": "store-1" },
      manifest: "<x/>",
      scoStructure: {},
      entryPoint: "index.html",
    })) as { courseId: string; slug: string };

    expect(result.slug).toBe("diversidad-equidad-e-inclusion");
    expect(inserts).toHaveLength(1);
    expect(inserts[0].row).toMatchObject({
      campusCourseId: "CAMPUS-001",
      status: "draft",
      entryPoint: "index.html",
    });
  });

  it("disambiguates the slug when a course with the same slug already exists", async () => {
    const { ctx } = buildMutationCtx({
      existingSlugRow: { _id: "existing", slug: "duplicate-title" },
    });
    const result = (await insertHandler(ctx, {
      campusCourseId: "CAMPUS-ABCDEF123456",
      title: "Duplicate Title",
      scoFiles: {},
      manifest: "<x/>",
      scoStructure: {},
    })) as { slug: string };
    expect(result.slug).toBe("duplicate-title-123456");
  });
});
