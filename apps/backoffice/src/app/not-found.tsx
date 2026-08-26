import { NotFound } from '@/components/layout/NotFound';

/**
 * APP-WIDE 404 fallback (C-02).
 *
 * Next only reaches a not-found.tsx for a path that resolved into that
 * segment's tree. A request for a path matching NO route at all — this app has
 * only (auth) and (dashboard), so anything outside both, e.g. /whatever — has no
 * segment to fall into, so without this file it fell through to Next's built-in
 * 404: "This page could not be found.", in English, on a document declaring
 * lang="es", unbranded and with no link out.
 *
 * Mirrors apps/academia's app/not-found.tsx (added 2026-08-07, eba96c4). This
 * app deliberately does NOT import anything from academia — the two apps are
 * separate domains; the panel is re-implemented locally in
 * @/components/layout/NotFound.
 */
export default function RootNotFound() {
  return <NotFound />;
}
