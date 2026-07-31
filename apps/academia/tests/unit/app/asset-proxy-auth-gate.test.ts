/**
 * ASSET PROXY ACCESS GATE (T-fe-008b) — the security control, pinned.
 *
 * This route streams PAID course content. Before T-fe-008b it authenticated
 * nothing: an anonymous `GET /api/lms/asset/<publicSlug>/imsmanifest.xml`
 * returned the real manifest (which enumerates every file in the package) and
 * `content/unidad_01/unidad.html` returned 73 KB of real course material. The
 * slug is public — it is in the catalog HTML — so that was the entire revenue
 * model behind a guessable URL.
 *
 * These tests exist so the control cannot be deleted or weakened silently. If
 * someone removes the session read or the enrollment check, the corresponding
 * case here goes red. Making them green by relaxing the expectations is a
 * sprint-level regression, not a fix.
 *
 * The `completed` case is not padding: the obvious implementation would gate on
 * `enrollments.getMyEnrollment`, which hard-filters `status: "active"` and would
 * therefore lock out every learner who already finished the course. That
 * regression is exactly what this suite pins against.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    query = query;
  },
}));

const getLearnerSession = vi.fn();
vi.mock("@/features/auth-learner/lib/session", () => ({
  getLearnerSession: () => getLearnerSession(),
}));

// The route builds its Convex client at module scope from this env var.
process.env.NEXT_PUBLIC_CONVEX_URL ??= "https://example.convex.cloud";

import { getFunctionName } from "convex/server";
import { GET } from "@/app/api/lms/asset/[slug]/[...path]/route";

// The generated `api` object is a Proxy that mints a FRESH reference on every
// property access, so neither `===` nor String() works on it (String() throws
// "Cannot convert object to primitive value"). `getFunctionName` is the
// supported way to identify a reference: it yields "lms/courses:getBySlug".
// Dispatching on it also pins WHICH query the gate calls — swapping
// listMyEnrollments for the active-only getMyEnrollment makes these tests throw
// rather than silently narrowing access for `completed` learners.
const nameOf = (fn: unknown) => getFunctionName(fn as never);

const SLUG = "curso-publico";
const COURSE_ID = "course_1";
const LEARNER_ID = "learner_1";
const STORAGE_ID = "storage_1";
const MANIFEST_BYTES = "<manifest>real manifest bytes</manifest>";

const SESSION = {
  learnerId: LEARNER_ID,
  email: "learner@example.com",
  type: "individual" as const,
  exp: Math.floor(Date.now() / 1000) + 3600,
};

const COURSE = {
  _id: COURSE_ID,
  slug: SLUG,
  title: "Curso DEI",
  scoFiles: { "imsmanifest.xml": STORAGE_ID },
};

/** Both request shapes that leaked real bytes in the reproduction. */
const REQUESTS: Array<{ label: string; path: string[] }> = [
  { label: "imsmanifest.xml", path: ["imsmanifest.xml"] },
  {
    label: "content/unidad_01/unidad.html",
    path: ["content", "unidad_01", "unidad.html"],
  },
];

const call = (path: string[]) =>
  GET({} as never, {
    params: Promise.resolve({ slug: SLUG, path }),
  });

/**
 * Wires the happy path: getBySlug -> listMyEnrollments -> files.getUrl, then a
 * storage fetch. `enrollments` shapes the entitlement under test.
 */
const wire = (enrollments: Array<{ courseId: string; status: string }>) => {
  query.mockImplementation((fn: unknown, args: Record<string, unknown>) => {
    const name = nameOf(fn);
    if (name === "lms/courses:getBySlug") return Promise.resolve(COURSE);
    if (name === "lms/enrollments:listMyEnrollments") {
      expect(args.learnerId).toBe(LEARNER_ID);
      return Promise.resolve(enrollments);
    }
    if (name === "files:getUrl") return Promise.resolve("https://storage.test/x");
    throw new Error(`the gate called an unexpected Convex query: ${name}`);
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(MANIFEST_BYTES, { status: 200 }))
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("asset proxy — DENY unauthenticated", () => {
  for (const { label, path } of REQUESTS) {
    it(`refuses ${label} with no learner session`, async () => {
      getLearnerSession.mockResolvedValue(null);
      wire([{ courseId: COURSE_ID, status: "active" }]);

      const res = await call(path);

      expect(res.status).toBe(401);
      expect(await res.text()).toBe("Unauthorized");
      // Nothing is looked up at all: an anonymous caller must not even learn
      // whether the slug resolves.
      expect(query).not.toHaveBeenCalled();
    });
  }

  it("does not authorise a shared cache to keep a denial or the bytes", async () => {
    getLearnerSession.mockResolvedValue(null);
    wire([]);
    const denied = await call(["imsmanifest.xml"]);
    expect(denied.headers.get("Cache-Control")).toBe("no-store");

    getLearnerSession.mockResolvedValue(SESSION);
    wire([{ courseId: COURSE_ID, status: "active" }]);
    const served = await call(["imsmanifest.xml"]);
    // `public` here would let Vercel's edge hand the paid bytes to the next
    // caller regardless of the gate.
    expect(served.headers.get("Cache-Control")).toBe("private, max-age=3600");
    expect(served.headers.get("Cache-Control")).not.toContain("public");
  });
});

describe("asset proxy — DENY authenticated but not enrolled", () => {
  for (const { label, path } of REQUESTS) {
    it(`refuses ${label} for a learner with no enrollment in this course`, async () => {
      getLearnerSession.mockResolvedValue(SESSION);
      wire([]);

      const res = await call(path);

      expect(res.status).toBe(404);
      expect(await res.text()).toBe("Not found");
    });
  }

  it("refuses a learner enrolled in a DIFFERENT course", async () => {
    getLearnerSession.mockResolvedValue(SESSION);
    wire([{ courseId: "course_other", status: "active" }]);

    const res = await call(["imsmanifest.xml"]);

    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Not found");
  });

  it("refuses an EXPIRED enrollment", async () => {
    getLearnerSession.mockResolvedValue(SESSION);
    wire([{ courseId: COURSE_ID, status: "expired" }]);

    const res = await call(["imsmanifest.xml"]);

    expect(res.status).toBe(404);
  });
});

describe("asset proxy — ALLOW an entitled learner", () => {
  it("serves the manifest bytes for an ACTIVE enrollment", async () => {
    getLearnerSession.mockResolvedValue(SESSION);
    wire([{ courseId: COURSE_ID, status: "active" }]);

    const res = await call(["imsmanifest.xml"]);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/xml; charset=utf-8");
    expect(await res.text()).toBe(MANIFEST_BYTES);
  });

  it("serves a COMPLETED enrollment — finishing a course does not revoke it", async () => {
    getLearnerSession.mockResolvedValue(SESSION);
    wire([{ courseId: COURSE_ID, status: "completed" }]);

    const res = await call(["imsmanifest.xml"]);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(MANIFEST_BYTES);
  });
});

describe("asset proxy — denials leak nothing", () => {
  it("returns the SAME body for course-missing, not-enrolled and asset-missing", async () => {
    getLearnerSession.mockResolvedValue(SESSION);

    // Course does not exist.
    query.mockImplementation((fn: unknown) => {
      const name = nameOf(fn);
      if (name === "lms/courses:getBySlug") return Promise.resolve(null);
      throw new Error(`the gate called an unexpected Convex query: ${name}`);
    });
    const noCourse = await call(["imsmanifest.xml"]);

    // Course exists, learner not enrolled.
    wire([]);
    const notEnrolled = await call(["imsmanifest.xml"]);

    // Entitled, but the file is not in the package.
    wire([{ courseId: COURSE_ID, status: "active" }]);
    const noAsset = await call(["secret", "does-not-exist.html"]);

    for (const res of [noCourse, notEnrolled, noAsset]) {
      expect(res.status).toBe(404);
      expect(await res.text()).toBe("Not found");
    }
    // Specifically: the requested path is never reflected back.
    expect(await (await call(["secret", "does-not-exist.html"])).text()).not.toContain(
      "does-not-exist"
    );
  });
});
