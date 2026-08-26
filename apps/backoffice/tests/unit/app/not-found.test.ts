/**
 * C-02 (backoffice half) — the root of the app must not 404, and an invented
 * URL must land on a branded panel instead of Next's built-in English 404.
 *
 * Source sweep, not a render test: this workspace's vitest environment is
 * `node` with no jsdom (see tests/vitest.config.ts) and no suite here renders
 * JSX. Mirrors the sweep style of tests/unit/features/lms/academiaLinks.test.ts
 * — assert the invariant against the file text rather than mounting it.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '../../../src');
const NOT_FOUND_SRC = fs.readFileSync(path.join(SRC, 'app/not-found.tsx'), 'utf8');
const ROOT_PAGE_SRC = fs.readFileSync(path.join(SRC, 'app/page.tsx'), 'utf8');
const PANEL_SRC = fs.readFileSync(
  path.join(SRC, 'components/layout/NotFound/NotFound.tsx'),
  'utf8'
);

describe('app/not-found.tsx — the app-wide 404 fallback exists', () => {
  it('renders the branded panel, not nothing', () => {
    expect(NOT_FOUND_SRC).toMatch(/@\/components\/layout\/NotFound/);
    expect(NOT_FOUND_SRC).toMatch(/<NotFound\s*\/>/);
  });

  it('imports nothing from apps/academia — the two apps are separate domains', () => {
    // Narrative comments legitimately mention "academia" (it is the pattern
    // being mirrored); an actual cross-app import would show up as an import
    // statement naming it as a source.
    const IMPORTS_ACADEMIA = /^\s*import\b[^;]*['"][^'"]*academia[^'"]*['"]/im;
    expect(NOT_FOUND_SRC).not.toMatch(IMPORTS_ACADEMIA);
    expect(PANEL_SRC).not.toMatch(IMPORTS_ACADEMIA);
  });
});

describe('the branded 404 panel', () => {
  it('carries a Spanish message and a way back, in Spanish (the bug: the native 404 is English)', () => {
    expect(PANEL_SRC).toMatch(/no encontrada/i);
    expect(PANEL_SRC).toMatch(/Volver al inicio/);
  });

  it('links out with next/link (client-side nav), not a bare <a>', () => {
    expect(PANEL_SRC).toMatch(/from 'next\/link'/);
    expect(PANEL_SRC).toMatch(/<Link\s+href=/);
  });

  it('the way back is relative ("/"), because this app owns that route (unlike academia\'s absolute institutional link)', () => {
    expect(PANEL_SRC).toMatch(/href="\/"/);
  });

  it('declares no literal colour — only design tokens (token-coherence.test.ts P-1 invariant)', () => {
    const css = fs.readFileSync(
      path.join(SRC, 'components/layout/NotFound/NotFound.module.css'),
      'utf8'
    );
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    // "white"/"currentColor" are CSS keywords, not literals the token guard
    // tracks — the same allowance packages/ui/src/styles/button.module.css uses.
    expect(css.match(/rgba?\(|hsla?\(/g)).toBeNull();
  });
});

describe('app/page.tsx — the root resolves session instead of 404ing', () => {
  it('checks session before deciding where to send the visitor', () => {
    expect(ROOT_PAGE_SRC).toMatch(/getSession/);
    expect(ROOT_PAGE_SRC).toMatch(/redirect\(/);
  });

  it('imports getSession the same way (dashboard)/admin/page.tsx does — one source of truth for "is there a session"', () => {
    expect(ROOT_PAGE_SRC).toMatch(/@\/features\/auth\/lib\/session/);
  });
});
