# ADR-0005 — Same-origin proxy for SCO assets

- **Status:** Accepted (2026-06-05)
- **Sprint:** SPRINT-ZEPHYRA-LMS-0 (discovered) / SPRINT-ZEPHYRA-LMS-1 (locked into ADR)
- **Spec:** `specs/008-zephyra-lms-foundation/`
- **Relates to:** [ADR-0002](./0002-scorm-1.2-as-canonical-content-format.md)

## Context

The provider's SCORM 1.2 content ("CAMPUS") discovers the LMS runtime by
walking `window.parent` looking for `window.parent.API`, and additionally calls
`window.parent.document.querySelectorAll('iframe')` to introspect the host
page's navigation. Both are scripted reads across the iframe/parent boundary,
so the browser's same-origin policy gates them.

If SCO assets were served directly from `*.convex.cloud` (the natural choice —
Convex `_storage` exposes a signed `getUrl(storageId)`), the iframe would be
cross-origin with the player page. The browser would then block both
`window.parent.API` and `window.parent.document.querySelectorAll('iframe')`,
and the `scorm-again` bridge would never receive a `LMSInitialize` call. This
was risk **S0-R3** in the Sprint 0 plan and the Phase D spike confirmed it
empirically.

## Decision

Every SCO asset is served through the Next.js route handler
`/api/lms/asset/[slug]/[...path]` (`src/app/api/lms/asset/[slug]/[...path]/route.ts`).
The handler resolves the requested path against the course's `scoFiles` map,
calls `ctx.storage.get(storageId)` server-side, and streams the bytes back with
the correct `Content-Type` header. The Convex `_storage.getUrl(storageId)`
function is used ONLY inside the proxy as an internal implementation detail
and is **never** returned to the iframe.

## Consequences

- The bridge works structurally (S0-R3 resolved). The iframe is same-origin
  with the player page, so `window.parent.API` and `window.parent.document`
  are both reachable from inside the SCO.
- Caching, content-type negotiation, and access-control headers are controlled
  centrally by the proxy rather than scattered across signed URLs.
- One extra hop per asset (Vercel edge → Convex `_storage` → bytes back to the
  edge). For ~50-file SCORM packages this is acceptable; measured ingest +
  first-paint stayed comfortably under the demo-loop budget.
- The proxy must stay publicly reachable (no auth gate at the route level)
  because asset URLs are emitted into the SCO's HTML and need to load from the
  iframe without an auth round-trip. Draft leakage is prevented at the
  resolution layer: the handler refuses to serve files for courses whose
  `status` is not `"published"` (or for the explicitly allow-listed admin
  preview surface). See ADR-0007 for the broader auth model and E03 for the
  status-gated catalog code.
- The proxy is mandatory, not a fallback. Reintroducing raw `getUrl` for SCO
  assets would silently re-break the bridge in a way that is hard to diagnose
  (the SCO would simply never initialize and the player would show a stuck
  spinner).

## Alternatives considered

- **Raw `_storage.getUrl(storageId)` returned to the iframe.** Rejected — the
  resulting `*.convex.cloud` iframe is cross-origin with the player and the
  bridge breaks. This was the Sprint 0 starting point and is what the spike
  proved wrong.
- **CORS / `crossorigin` configuration on Convex `_storage`.** Rejected — even
  if CORS allowed cross-origin reads, the `window.parent.document` traversal
  the provider performs is gated by the same-origin policy at the DOM level,
  not by CORS. Adjusting CORS does not fix DOM access.
- **Host the SCO on a separate sub-path of the same origin (e.g.
  `/scorm-static/...`) served by a CDN.** Rejected — would require either
  copying assets out of Convex `_storage` into a CDN bucket on each ingest, or
  fronting Convex with a custom domain. The route handler is simpler, keeps
  Convex `_storage` as the single source of truth, and adds no infrastructure.
