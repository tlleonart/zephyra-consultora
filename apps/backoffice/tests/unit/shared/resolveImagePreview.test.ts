/**
 * C-01 (SPLIT-4, M-FIX). Regression coverage for the broken-image-on-reload
 * bug: ImageUpload built its own `src` as `/api/storage/${value}` instead of
 * asking Convex, and that route never existed in any of the three apps
 * (verified against `git log --all`). It "worked" only for as long as
 * `preview` — a `URL.createObjectURL` blob scoped to the upload session — was
 * still set. Reload the page, or navigate away and back, and every saved
 * image rendered broken. None of the (pre-fix) 538 tests caught it because
 * none exercised the "no local preview" path — a tester found it by hand.
 *
 * The fix lives in `resolveImagePreview` (packages/ui), a pure function kept
 * separate from the component precisely so this path is unit-testable: this
 * workspace's vitest runs `environment: "node"` with no jsdom (see
 * apps/backoffice/vitest.config.ts), so a component-render test is not an
 * option here, and none of the seven consumers of ImageUpload lives outside
 * this app anyway.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { resolveImagePreview } from '@zephyra/ui';

describe('resolveImagePreview — "no local preview" (the case that escaped)', () => {
  it('is "loading", not empty and not the stale local preview, right after a reload', () => {
    // Reload: preview is gone (it never survives a navigation), a storage id
    // is present (the form loaded saved data), and useQuery has not resolved
    // yet — its own "loading" signal is `undefined`, never `null`.
    const state = resolveImagePreview(null, 'kg2abc123', undefined);
    expect(state).toEqual({ status: 'loading' });
  });

  it('resolves to the real URL once Convex answers — the saved image renders again', () => {
    const state = resolveImagePreview(
      null,
      'kg2abc123',
      'https://exemplary.convex.cloud/api/storage/kg2abc123'
    );
    expect(state).toEqual({
      status: 'ready',
      src: 'https://exemplary.convex.cloud/api/storage/kg2abc123',
    });
  });

  it('falls back to the placeholder, not a broken image, when the storage id no longer resolves', () => {
    // Convex resolved the query and answered `null`: the file was deleted out
    // from under a stale id. This must look the same as "no image", not like
    // a 404'd <img>.
    const state = resolveImagePreview(null, 'kg2deleted', null);
    expect(state).toEqual({ status: 'empty' });
  });
});

describe('resolveImagePreview — the other states', () => {
  it('is empty with no local preview and no storage id — the untouched dropzone', () => {
    expect(resolveImagePreview(null, null, undefined)).toEqual({ status: 'empty' });
    expect(resolveImagePreview(null, undefined, undefined)).toEqual({ status: 'empty' });
  });

  it('the local preview wins over everything else while it lives', () => {
    // Mid-upload: a blob preview is set immediately, before Convex even has a
    // storage id to query with (so the query is 'skip'd upstream and this
    // function receives remoteUrl=undefined) — the preview must not wait on it.
    const midUpload = resolveImagePreview('blob:http://localhost/abc', null, undefined);
    expect(midUpload).toEqual({ status: 'ready', src: 'blob:http://localhost/abc' });

    // Also true once a storage id exists but the resolved remote URL differs
    // (e.g. mid re-upload of a replacement image): the fresh local blob still
    // wins so the preview stays instant rather than flashing the old image.
    const midReplace = resolveImagePreview(
      'blob:http://localhost/def',
      'kg2old',
      'https://exemplary.convex.cloud/api/storage/kg2old'
    );
    expect(midReplace).toEqual({ status: 'ready', src: 'blob:http://localhost/def' });
  });
});

describe('the /api/storage/<id> route this bug depended on stays gone', () => {
  it('ImageUpload no longer builds a src from a literal /api/storage path', () => {
    const source = readFileSync(
      path.resolve(
        __dirname,
        '../../../../../packages/ui/src/components/ui/ImageUpload/ImageUpload.tsx'
      ),
      'utf8'
    );
    expect(source).not.toMatch(/\/api\/storage\//);
  });
});
