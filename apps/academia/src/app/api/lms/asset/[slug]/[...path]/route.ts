import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@zephyra/convex/_generated/api";
import { Id } from "@zephyra/convex/_generated/dataModel";
import { getLearnerSession } from "@/features/auth-learner/lib/session";

export const dynamic = "force-dynamic";

/**
 * SCORM asset proxy (Phase D — AC-D02.2 / AC-D02.6).
 *
 * Why a same-origin proxy instead of raw Convex `getUrl` (S0-R3 resolved):
 * the CAMPUS SCORM content discovers the LMS API by walking `window.parent`
 * and also calls `window.parent.document.querySelectorAll('iframe')`. If the
 * iframe were served from `*.convex.cloud` (a different origin from the player
 * page), the browser's same-origin policy would BLOCK both `window.parent.API`
 * and `window.parent.document` — the bridge could never work. Serving every SCO
 * asset from THIS origin (the Next.js app) makes the iframe same-origin with
 * the player, so the provider's `getAPI()` loop finds `window.parent.API`.
 *
 * Route shape: /api/lms/asset/<courseSlug>/<relative/path/inside/package>
 * The relative path is resolved against the course's scoFiles map
 * (path -> Id<"_storage">), the bytes are streamed from Convex `_storage`, and
 * the correct Content-Type is set so HTML/JS/CSS/images/fonts all load.
 *
 * ACCESS GATE (T-fe-008b). This route streams PAID course content, so it is
 * gated on a valid learner session AND an enrollment in THIS course. Session
 * alone is insufficient: any registered learner could otherwise pull a course
 * they never bought. The credential needs no plumbing — the player iframe is
 * same-origin (see above), so the browser already sends the `session-learner`
 * cookie on every asset request; before this change the handler simply never
 * read it.
 *
 * The gate lives HERE and not in middleware on purpose: src/middleware.ts's
 * matcher deliberately excludes `api` so the proxy is never intercepted (a
 * redirect-to-signin response inside a SCO iframe would be a silent, confusing
 * failure). Keep it that way.
 *
 * Statuses allowed: `active` + `completed`. `expired` and "no row" are denied.
 * Gating on `enrollments.getMyEnrollment` would have been the obvious move and
 * would have been a REGRESSION: that query hard-filters `status: "active"`, so
 * every learner who already finished the course would lose access to material
 * they paid for and are entitled to revisit. We therefore compose the rule from
 * `enrollments.listMyEnrollments` (learnerId only; returns every non-expired
 * row, i.e. active + completed) and match on courseId — no new backend surface.
 *
 * Denials are INFORMATION-FREE: one 401 body for "no session" and one
 * identical 404 body for course-missing / not-enrolled / asset-missing, so the
 * route cannot be used to enumerate which slugs or files exist.
 */

// Every denial returns one of exactly two responses. Never interpolate the
// requested slug or path into a denial body (that both reflects input and
// confirms what was asked for).
const DENY_UNAUTHENTICATED = () =>
  new NextResponse("Unauthorized", {
    status: 401,
    headers: { "Cache-Control": "no-store" },
  });

const DENY_NOT_FOUND = () =>
  new NextResponse("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });

const READABLE_ENROLLMENT_STATUSES = new Set(["active", "completed"]);

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const CONTENT_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  ico: "image/x-icon",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  eot: "application/vnd.ms-fontobject",
  otf: "font/otf",
  xsd: "application/xml; charset=utf-8",
};

function contentTypeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; path: string[] }> }
) {
  const { slug, path } = await params;
  // The content packages assets relative to the package root; rebuild that path.
  const relPath = decodeURIComponent(path.join("/")).replace(/\\/g, "/");

  // 1. Identity. Checked FIRST, before any lookup, so an anonymous caller
  //    learns nothing at all — not even whether the slug resolves.
  const session = await getLearnerSession();
  if (!session) {
    return DENY_UNAUTHENTICATED();
  }

  const course = await convex.query(api.lms.courses.getBySlug, { slug });
  if (!course) {
    return DENY_NOT_FOUND();
  }

  // 2. Entitlement. Identity is not access: the learner must hold a readable
  //    enrollment in THIS course.
  const enrollments = await convex.query(api.lms.enrollments.listMyEnrollments, {
    learnerId: session.learnerId,
  });
  const isEntitled = (enrollments ?? []).some(
    (e) => e.courseId === course._id && READABLE_ENROLLMENT_STATUSES.has(e.status)
  );
  if (!isEntitled) {
    return DENY_NOT_FOUND();
  }

  const scoFiles = (course.scoFiles ?? {}) as Record<string, Id<"_storage">>;

  // Resolve the requested path against the stored file map. Try exact match,
  // then a normalized match that tolerates "./" and redundant separators.
  let storageId = scoFiles[relPath];
  if (!storageId) {
    const norm = relPath.replace(/^\.?\//, "");
    storageId =
      scoFiles[norm] ??
      Object.entries(scoFiles).find(
        ([k]) => k.replace(/^\.?\//, "") === norm
      )?.[1];
  }

  if (!storageId) {
    return DENY_NOT_FOUND();
  }

  const url = await convex.query(api.files.getUrl, {
    storageId,
  });
  if (!url) {
    return new NextResponse("Asset storage URL unavailable", { status: 502 });
  }

  const upstream = await fetch(url);
  if (!upstream.ok || !upstream.body) {
    return new NextResponse("Failed to fetch asset from storage", {
      status: 502,
    });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentTypeFor(relPath),
      // PRIVATE, not public (T-fe-008b). Assets are immutable per ingest, so
      // the browser may still cache them for the session — but the response is
      // now entitlement-dependent, and `public` would authorise a shared cache
      // (Vercel's edge / any CDN) to hand the paid bytes to the NEXT caller,
      // gate or no gate. That would defeat this whole change.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
