/**
 * C-01 (SPLIT-4). Pure, framework-free resolution of what an ImageUpload
 * should render for a given storage id, kept separate from the component so
 * it is testable without a DOM.
 *
 * The bug this exists to prevent: the component used to build the image URL
 * itself (`/api/storage/${value}`) instead of asking Convex, and that route
 * never existed in any of the three apps. A saved image looked fine only
 * while `preview` — a `URL.createObjectURL` blob that lives for the upload
 * session — was still set. Reload the page, or leave the form and come back,
 * and `preview` is gone: the exact case this function has to get right.
 *
 * Precedence, in order:
 *   1. `localPreview` — the just-uploaded blob URL, while it lives. Kept
 *      first so the preview stays instant during an upload even though a
 *      Convex round trip for the same storage id is in flight.
 *   2. no `storageId` at all — nothing to show.
 *   3. `remoteUrl === undefined` — `useQuery` has not resolved yet (this is
 *      Convex's own "loading" signal, not ours). This is the "no local
 *      preview" case a reload lands on: show a loading state, never an
 *      empty/broken `src`.
 *   4. `remoteUrl === null` — Convex resolved the query and the storage id no
 *      longer points at anything. Same placeholder as "no value", not a
 *      broken image.
 *   5. otherwise `remoteUrl` is the real, resolved URL.
 */
export type ImagePreviewState =
  | { status: 'empty' }
  | { status: 'loading' }
  | { status: 'ready'; src: string };

export function resolveImagePreview(
  localPreview: string | null,
  storageId: string | null | undefined,
  remoteUrl: string | null | undefined
): ImagePreviewState {
  if (localPreview) {
    return { status: 'ready', src: localPreview };
  }
  if (!storageId) {
    return { status: 'empty' };
  }
  if (remoteUrl === undefined) {
    return { status: 'loading' };
  }
  if (remoteUrl === null) {
    return { status: 'empty' };
  }
  return { status: 'ready', src: remoteUrl };
}
