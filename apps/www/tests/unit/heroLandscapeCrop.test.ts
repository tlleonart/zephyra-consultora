/**
 * C-06 (M-FIX) — the hero no longer over-crops on a short (landscape phone)
 * viewport.
 *
 * REPRODUCED, not assumed: with Playwright at 844x390 (iPhone 13 rotated —
 * test A-01-6) before this fix, `.hero { min-height: 100vh }` pinned the
 * section to the viewport's own 390px height. hero-background.jpg is
 * 5184x3888 (4:3); `background-size: cover` at an 844px-wide, 390px-tall box
 * has to scale the image to 844x633 and then crop 243px off it (~38%),
 * centered — which sliced through the people's heads at the top and their
 * hands at the bottom of the photo. Portrait was never affected: the same
 * viewport is 844px tall there, well over what cover ever needs to crop.
 *
 * No other surface on the home page is affected by orientation: ServicesSection,
 * ProjectsSection and TeamSection's card images all use fixed pixel heights
 * (200px / 120px), not `vh` — confirmed by grep, asserted below so a future
 * change introducing a viewport-relative card height fails here rather than
 * silently reproducing this defect on a second surface.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '../../src');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

describe('HeroSection — min-height has an absolute floor under the viewport unit', () => {
  const css = read('components/public/HeroSection/HeroSection.module.css');

  it('no longer pins .hero to a bare 100vh', () => {
    // The exact pre-fix shape: a landscape phone's 100vh is ~390px, which is
    // what forced the 38% crop. A bare `min-height: 100vh;` is the regression.
    expect(css).not.toMatch(/\.hero\s*\{[^}]*min-height:\s*100vh\s*;/);
  });

  it('sets a floor at or above 550px, so 100vh only wins on a tall-enough viewport', () => {
    const match = css.match(/\.hero\s*\{[^}]*min-height:\s*max\(100vh,\s*(\d+)px\)/);
    expect(match, 'expected min-height: max(100vh, <N>px) on .hero').not.toBeNull();
    const floor = Number(match![1]);
    // Below this the crop starts reproducing the reported defect (see the
    // module's own comment for the 13%-vs-38% math); comfortably above it the
    // fix stops doing anything, so the floor has to sit in a working range.
    expect(floor).toBeGreaterThanOrEqual(500);
    expect(floor).toBeLessThanOrEqual(700);
  });

  it('still covers, still centers — only the height rule changed', () => {
    expect(css).toContain('background-size: cover');
    expect(css).toContain('background-position: center');
  });
});

describe('no other home-page surface sizes an image off the viewport height', () => {
  const cardCss = [
    'components/public/ProjectsSection/ProjectsSection.module.css',
    'components/public/TeamSection/TeamSection.module.css',
  ].map(read);

  it('ServicesSection, ProjectsSection and TeamSection cards use fixed pixel heights, not vh', () => {
    for (const css of cardCss) {
      expect(css).not.toMatch(/height:\s*\d+vh/);
    }
  });
});
