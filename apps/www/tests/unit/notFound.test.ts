/**
 * ROOT 404 BOUNDARY — structural guard.
 *
 * WHY THIS EXISTS. apps/www had app/(public)/not-found.tsx but no
 * app/not-found.tsx. Next only reaches a nested not-found.tsx for a path that
 * resolved INTO that segment; a path matching no route at all had no segment
 * to fall into and fell through to Next's built-in "This page could not be
 * found." — English copy on a document declaring lang="es", unbranded, no
 * link out. Confirmed against `GET /pagina-inventada-xyz` on the deployed
 * build; both A2 testers reported it independently.
 *
 * Same defect class, same fix shape as apps/academia's app/not-found.tsx
 * (commit eba96c4) — this is www's own copy, not a shared import (the apps
 * are separate and do not import across that boundary).
 *
 * WHY A TEST AND NOT JUST THE FILE. The root boundary is easy to delete by
 * accident (it looks redundant next to the (public) one) and its absence is
 * invisible until someone hits an unmatched path in production. No DOM, no
 * browser: pure filesystem + source guards, so it runs in the `test` job on
 * every push.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const APP = path.resolve(__dirname, '../..');
const SRC = path.join(APP, 'src');

const BLOCK_COMMENT = new RegExp(String.raw`/\*[\s\S]*?\*/`, 'g');
const LINE_COMMENT = new RegExp(String.raw`^\s*//.*$`, 'gm');
const JSX_COMMENT = new RegExp(String.raw`\{\s*/\*[\s\S]*?\*/\s*\}`, 'g');
const code = (src: string) =>
  src.replace(JSX_COMMENT, '').replace(BLOCK_COMMENT, '').replace(LINE_COMMENT, '');

describe('both 404 boundaries exist and share one branded panel', () => {
  it('the app-wide fallback boundary exists', () => {
    expect(fs.existsSync(path.join(SRC, 'app/not-found.tsx'))).toBe(true);
  });

  it('the (public) segment boundary still exists (it is the one with the navbar)', () => {
    expect(fs.existsSync(path.join(SRC, 'app/(public)/not-found.tsx'))).toBe(true);
  });

  it('both boundaries render the shared panel rather than their own markup', () => {
    for (const p of ['app/not-found.tsx', 'app/(public)/not-found.tsx']) {
      const src = code(fs.readFileSync(path.join(SRC, p), 'utf8'));
      expect(src, p).toContain('@/components/public/NotFound');
      // Duplicated markup is how the two drift: one gets fixed, the other does
      // not, and only one of them is reachable in any given manual test.
      expect(src, p).not.toMatch(/<h1|className=\{styles\./);
    }
  });

  it('the panel offers a way out', () => {
    const src = code(
      fs.readFileSync(path.join(SRC, 'components/public/NotFound/NotFound.tsx'), 'utf8')
    );
    expect(src).toMatch(/href="\/"/);
  });

  it('the panel is Spanish copy, not the Next default', () => {
    const src = fs.readFileSync(
      path.join(SRC, 'components/public/NotFound/NotFound.tsx'),
      'utf8'
    );
    expect(src).not.toMatch(/This page could not be found/i);
    expect(src).toMatch(/no encontrada/i);
  });
});
