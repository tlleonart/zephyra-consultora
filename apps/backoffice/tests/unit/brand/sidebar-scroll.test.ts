/**
 * C-04 — the twelve-section sidebar is reachable AND discoverable in a short
 * window.
 *
 * Verified against a live authenticated Chromium walk at the reporting
 * tester's own viewport (1496×526, staging) before this fix: `scrollHeight`
 * 623 vs `clientHeight` 526 on the sidebar; LMS, Usuarios and Papelera below
 * the fold with no visible cue. The ancestor `<aside>`
 * (components/layout/DashboardLayout) already carried `overflow-y: auto`, so
 * the items were technically reachable by scrolling it — a tester still
 * reported a whole section "missing", because nothing on screen said there was
 * more below. Same spirit as mobile-nav-targets.test.ts and
 * token-coherence.test.ts: assert the things a browser fails SILENTLY on. A
 * jsdom-free run cannot exercise scroll geometry (this workspace's vitest
 * `environment` is `node` — see tests/vitest.config.ts), so this is a source
 * sweep of the actual rules rather than a render test.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(__dirname, '../../../../..');
const read = (rel: string) => fs.readFileSync(path.join(REPO, rel), 'utf8');

const SIDEBAR_DIR = 'apps/backoffice/src/features/dashboard/components/Sidebar';
const SIDEBAR_CSS = read(`${SIDEBAR_DIR}/Sidebar.module.css`);
const SIDEBAR_TSX = read(`${SIDEBAR_DIR}/Sidebar.tsx`);

const BLOCK_COMMENT = new RegExp(String.raw`/\*[\s\S]*?\*/`, 'g');
const code = (src: string) => src.replace(BLOCK_COMMENT, '');

/** Isolates a single top-level `.selector { ... }` rule's body (first match). */
const rule = (css: string, selector: string): string => {
  const escaped = selector.replace(/[.[\]]/g, '\\$&');
  const m = code(css).match(new RegExp(String.raw`${escaped}\s*\{([^}]*)\}`));
  if (!m) throw new Error(`rule ${selector} not found`);
  return m[1];
};

describe('the twelve nav destinations all exist in the source (regression control)', () => {
  it('has exactly twelve entries in navItems — the count the tester counted', () => {
    const hrefs = [...SIDEBAR_TSX.matchAll(/href:\s*'([^']+)'/g)].map((m) => m[1]);
    expect(hrefs).toHaveLength(12);
    expect(hrefs).toContain('/admin/lms');
    expect(hrefs).toContain('/admin/users');
    expect(hrefs).toContain('/admin/trash');
  });
});

describe('C-04 — .nav owns its own scroll, not just the ancestor aside', () => {
  const navRule = rule(SIDEBAR_CSS, '.nav');

  it('is a shrinkable flex child — flex + min-height: 0 (the load-bearing part)', () => {
    // Without min-height: 0 a column-flex item refuses to shrink below its
    // content height and silently overflows onto an ancestor instead of
    // scrolling in place. This is exactly the bug: the ancestor DID scroll,
    // but invisibly.
    expect(navRule).toMatch(/flex:\s*1/);
    expect(navRule).toMatch(/min-height:\s*0/);
  });

  it('scrolls vertically on itself', () => {
    expect(navRule).toMatch(/overflow-y:\s*auto/);
  });

  it('carries a background-driven scroll cue, not just overflow: auto', () => {
    // overflow:auto alone was already true one level up (the aside) and a
    // tester still missed the content — the cue is the actual fix.
    expect(navRule).toMatch(/background:/);
    expect(navRule).toMatch(/background-attachment:\s*local,\s*local,\s*scroll,\s*scroll/);
  });

  it('the cue is built from tokens/keywords, not literal colour — token-coherence\'s invariant extends here', () => {
    expect(navRule).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    // var(--color-bg) / var(--color-overlay-scrim) + the `transparent` keyword
    // only.
    expect(navRule).toMatch(/var\(--color-bg\)/);
    expect(navRule).toMatch(/var\(--color-overlay-scrim\)/);
    expect(navRule).toMatch(/transparent/);
  });
});

describe('the logo stays pinned — only the list scrolls', () => {
  it('.sidebar (the outer flex column) has no overflow rule of its own — the list owns it', () => {
    const sidebarRule = rule(SIDEBAR_CSS, '.sidebar');
    expect(sidebarRule).not.toMatch(/overflow/);
  });

  it('.logo has no flex/overflow override that would let it shrink or scroll away', () => {
    const logoRule = rule(SIDEBAR_CSS, '.logo');
    expect(logoRule).not.toMatch(/flex:\s*1/);
    expect(logoRule).not.toMatch(/overflow/);
  });
});
