import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../../convex/_generated/api";

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
 */

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

  const course = await convex.query(api.lms.courses.getBySlug, { slug });
  if (!course) {
    return new NextResponse("Course not found", { status: 404 });
  }

  const scoFiles = (course.scoFiles ?? {}) as Record<string, string>;

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
    return new NextResponse(`Asset not found in package: ${relPath}`, {
      status: 404,
    });
  }

  const url = await convex.query(api.files.getUrl, {
    storageId: storageId as any,
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
      // Same-origin cache; assets are immutable per ingest.
      "Cache-Control": "public, max-age=3600",
    },
  });
}
