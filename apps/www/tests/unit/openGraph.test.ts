/**
 * OPEN GRAPH METADATA — C-03 (M-FIX).
 *
 * WHY THIS EXISTS. `grep openGraph apps/www/src` returned zero files: the root
 * layout declared only `title` + `description`, and no page declared any
 * `openGraph` fields — so sharing a link to the home page or a blog post
 * produced a preview with a title and NO image, on every platform that renders
 * link previews (confirmed by both A2 testers).
 *
 * HOW THIS IS TESTED. `lib/site.ts` is a plain module — safe to import and
 * exercise directly, so its half gets a real behavioural test (imported after
 * NEXT_PUBLIC_APP_URL is set, mirroring apps/academia's institutional-links
 * suite). The three route files that CONSUME it (root layout, home page, the
 * blog post page) are NOT imported here: this workspace's vitest config is
 * `environment: "node"` with no jsdom and no CSS-module handling (by design —
 * see vitest.config.ts), and the blog post page in particular pulls in a
 * 'use client' component with a CSS Module import that only Next's own build
 * pipeline resolves. Importing them would fail on tooling, not on the code
 * under test. So, consistent with this suite's own notFound/generatedUrlHosts
 * tests, those three are asserted structurally: the exact strings that make
 * the metadata correct must be present in source, and the exact shapes that
 * broke it (a relative image, a missing `images` array) must be absent.
 */
import { describe, expect, it, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const APP = path.resolve(__dirname, '../..');
const SRC = path.join(APP, 'src');

describe('lib/site.ts — the single resolution point', () => {
  const ORIGIN = 'https://zephyraconsultora.com';
  let mod: typeof import('@/lib/site');

  beforeAll(async () => {
    // SITE_URL resolves at MODULE scope via requireOrigin, so the env var has
    // to exist before the first import — same constraint as requireOrigin
    // itself and as apps/academia's institutional-links suite.
    process.env.NEXT_PUBLIC_APP_URL = ORIGIN;
    mod = await import('@/lib/site');
  });

  it('resolves an absolute, trailing-slash-free SITE_URL', () => {
    expect(mod.SITE_URL).toBe(ORIGIN);
  });

  it('builds an absolute default OG image, not a bare path', () => {
    expect(mod.DEFAULT_OG_IMAGE).toBe(`${ORIGIN}/images/hero-background.jpg`);
    // The exact defect this guards: a relative "/images/..." resolves against
    // nothing in most Open Graph scrapers.
    expect(mod.DEFAULT_OG_IMAGE).toMatch(/^https?:\/\//);
  });

  it('throws, naming the variable, when NEXT_PUBLIC_APP_URL is unset', async () => {
    // Fresh module instance: vitest caches ES module state per test file, so
    // isolate via resetModules within this one assertion.
    const original = process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    const { vi } = await import('vitest');
    vi.resetModules();
    await expect(import('@/lib/site')).rejects.toThrow(/NEXT_PUBLIC_APP_URL/);
    process.env.NEXT_PUBLIC_APP_URL = original;
    vi.resetModules();
  });
});

describe('the three route files declare complete Open Graph metadata', () => {
  const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

  it('the root layout: siteName, description, and an absolute default image', () => {
    const src = read('app/layout.tsx');
    expect(src).toContain('openGraph');
    expect(src).toContain('siteName');
    expect(src).toContain('DEFAULT_OG_IMAGE');
    expect(src).toContain("from '@/lib/site'");
    // The exact pre-fix shape: an openGraph block with no images at all.
    expect(src).toMatch(/images:\s*\[/);
  });

  it('the home page: its own openGraph block with an image', () => {
    const src = read('app/(public)/page.tsx');
    expect(src).toContain('openGraph');
    expect(src).toMatch(/images:\s*\[/);
    expect(src).toContain('DEFAULT_OG_IMAGE');
  });

  it('the blog post page: generateMetadata resolves the post server-side', () => {
    const src = read('app/(public)/blog/[slug]/page.tsx');
    expect(src).toContain('generateMetadata');
    expect(src).toContain('openGraph');
    // Must use the query's OWN resolved coverUrl (blogPosts.getBySlug already
    // calls ctx.storage.getUrl server-side) — not the client-side static
    // fallback map, which can hold a relative path.
    expect(src).toContain('post.coverUrl');
    expect(src).not.toContain('getBlogCoverImage');
    // The fallback for a post with no cover must be the absolute default, not
    // a bare path.
    expect(src).toContain('DEFAULT_OG_IMAGE');
  });

  it('none of the three hardcodes a relative image path in an openGraph block', () => {
    // The literal defect shape: `images: [{ url: "/images/..." }]`. A truly
    // relative OG image url is the exact thing DEFAULT_OG_IMAGE exists to
    // prevent, so no route file may spell one out itself.
    for (const rel of [
      'app/layout.tsx',
      'app/(public)/page.tsx',
      'app/(public)/blog/[slug]/page.tsx',
    ]) {
      const src = read(rel);
      expect(src, rel).not.toMatch(/url:\s*["'`]\/images\//);
    }
  });
});
