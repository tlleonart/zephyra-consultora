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

// Must satisfy the E03 strict parser: identifier + schemaversion=1.2 +
// organizations + non-empty resources.
const minimalManifestXml = `<?xml version="1.0"?>
<manifest identifier="TEST-MANIFEST">
  <metadata><schemaversion>1.2</schemaversion></metadata>
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
// E03 spec-drift FIX (PDD §6.3): re-ingesting the same campusCourseId now
// archives every non-archived predecessor row before inserting the new draft.
// These tests assert that contract — including the edge case where all prior
// rows are already archived (no double-archive, just an insert).

/**
 * Hand-rolled mock that supports two query shapes the implementation uses:
 *   - by_campus_course_id .eq("campusCourseId", id) .collect()
 *   - by_slug             .eq("slug", s)            .first()
 *
 * We track patches and inserts so tests can assert the archive + insert pair.
 */
type LmsRow = {
  _id: string;
  slug: string;
  status: "draft" | "published" | "archived";
  campusCourseId: string;
  archivedAt?: number;
  deletedAt?: number;
};

const buildMutationCtx = (
  overrides: Partial<{
    priorRows: LmsRow[];
    existingSlugRows: Record<string, LmsRow>; // slug -> row
  }> = {}
) => {
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  const patches: Array<{ id: string; row: Record<string, unknown> }> = [];
  const priorRows = overrides.priorRows ?? [];
  const existingSlugRows = overrides.existingSlugRows ?? {};

  const db = {
    query: vi.fn().mockImplementation(() => {
      // The handler chains: .withIndex(idxName, cb).first() OR .collect().
      // We pretend to introspect by storing the index name across calls.
      let activeIndex: string | null = null;
      let activeArg: string | null = null;
      const chain = {
        withIndex: vi.fn().mockImplementation((indexName: string, cb: (q: { eq: (field: string, value: string) => unknown }) => unknown) => {
          activeIndex = indexName;
          cb({
            eq: (_field: string, value: string) => {
              activeArg = value;
              return chain;
            },
          });
          return chain;
        }),
        first: vi.fn().mockImplementation(async () => {
          if (activeIndex === "by_slug" && activeArg) {
            return existingSlugRows[activeArg] ?? null;
          }
          return null;
        }),
        collect: vi.fn().mockImplementation(async () => {
          if (activeIndex === "by_campus_course_id") {
            return priorRows.filter((r) => r.campusCourseId === activeArg);
          }
          return [];
        }),
      };
      return chain;
    }),
    insert: vi
      .fn()
      .mockImplementation(async (table: string, row: Record<string, unknown>) => {
        inserts.push({ table, row });
        return `${table}-${inserts.length}`;
      }),
    patch: vi
      .fn()
      .mockImplementation(async (id: string, row: Record<string, unknown>) => {
        patches.push({ id, row });
      }),
  };
  return { ctx: { db }, db, inserts, patches };
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
    })) as { courseId: string; slug: string; archivedPriorCount: number };

    expect(result.slug).toBe("diversidad-equidad-e-inclusion");
    expect(result.archivedPriorCount).toBe(0);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].row).toMatchObject({
      campusCourseId: "CAMPUS-001",
      status: "draft",
      entryPoint: "index.html",
    });
  });

  it("disambiguates the slug when a course with the same slug already exists", async () => {
    const { ctx } = buildMutationCtx({
      existingSlugRows: {
        "duplicate-title": {
          _id: "existing",
          slug: "duplicate-title",
          status: "published",
          campusCourseId: "OTHER",
        },
      },
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

  it("archives the prior non-archived row when re-ingesting the same campusCourseId (PDD §6.3)", async () => {
    const prior: LmsRow = {
      _id: "course-prior",
      slug: "diversidad-equidad-e-inclusion",
      status: "published",
      campusCourseId: "CAMPUS-XYZ",
    };
    const { ctx, inserts, patches } = buildMutationCtx({
      priorRows: [prior],
      // The new slugified title collides with the prior published row, so the
      // suffix branch kicks in too.
      existingSlugRows: {
        "diversidad-equidad-e-inclusion": prior,
      },
    });
    const result = (await insertHandler(ctx, {
      campusCourseId: "CAMPUS-XYZ",
      title: "Diversidad, Equidad e Inclusión",
      scoFiles: {},
      manifest: "<x/>",
      scoStructure: {},
    })) as { archivedPriorCount: number; slug: string };

    expect(result.archivedPriorCount).toBe(1);
    expect(patches).toHaveLength(1);
    expect(patches[0]).toMatchObject({
      id: "course-prior",
      row: { status: "archived" },
    });
    expect(patches[0].row).toHaveProperty("archivedAt");
    expect(inserts).toHaveLength(1);
    expect(inserts[0].row).toMatchObject({ status: "draft" });
  });

  it("does NOT re-archive rows that are already archived (idempotent re-ingest)", async () => {
    const alreadyArchived: LmsRow = {
      _id: "course-old",
      slug: "old-slug",
      status: "archived",
      campusCourseId: "CAMPUS-ARCH",
      archivedAt: 1000,
    };
    const { ctx, inserts, patches } = buildMutationCtx({
      priorRows: [alreadyArchived],
    });
    const result = (await insertHandler(ctx, {
      campusCourseId: "CAMPUS-ARCH",
      title: "Fresh Title",
      scoFiles: {},
      manifest: "<x/>",
      scoStructure: {},
    })) as { archivedPriorCount: number };

    expect(result.archivedPriorCount).toBe(0);
    expect(patches).toHaveLength(0);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].row).toMatchObject({ status: "draft" });
  });

  it("archives MULTIPLE non-archived prior rows on re-ingest", async () => {
    const draftPrior: LmsRow = {
      _id: "course-draft",
      slug: "x",
      status: "draft",
      campusCourseId: "CAMPUS-MULTI",
    };
    const publishedPrior: LmsRow = {
      _id: "course-published",
      slug: "x2",
      status: "published",
      campusCourseId: "CAMPUS-MULTI",
    };
    const archivedPrior: LmsRow = {
      _id: "course-archived",
      slug: "x3",
      status: "archived",
      campusCourseId: "CAMPUS-MULTI",
      archivedAt: 1000,
    };
    const { ctx, patches } = buildMutationCtx({
      priorRows: [draftPrior, publishedPrior, archivedPrior],
    });
    const result = (await insertHandler(ctx, {
      campusCourseId: "CAMPUS-MULTI",
      title: "New",
      scoFiles: {},
      manifest: "<x/>",
      scoStructure: {},
    })) as { archivedPriorCount: number };

    expect(result.archivedPriorCount).toBe(2);
    expect(patches.map((p) => p.id).sort()).toEqual([
      "course-draft",
      "course-published",
    ]);
  });
});
