import { NotFound } from '@/components/public/NotFound';

/**
 * APP-WIDE 404 fallback.
 *
 * Next only reaches a nested not-found.tsx for a path that resolved into that
 * segment. A request for a path matching NO route at all — a typo, a stale
 * bookmark, `/pagina-inventada-xyz` — has no segment to fall into, so without
 * this file it fell through to Next's built-in 404: "This page could not be
 * found.", in English, on a document declaring lang="es", unbranded and with
 * no link out. Confirmed against the deployed staging build; both A2 testers
 * reported it independently.
 *
 * Same defect class, same fix shape as apps/academia/src/app/not-found.tsx
 * (commit eba96c4) — this app was simply missing the same root boundary.
 */
export default function RootNotFound() {
  return <NotFound />;
}
