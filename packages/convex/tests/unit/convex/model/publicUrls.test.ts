/**
 * convex/model/publicUrls — the backend's host resolver (M4).
 *
 * Guards the property the two money-path call sites depend on: this function
 * either returns academia's origin or THROWS. It never returns the apex, and it
 * never returns a value with a trailing slash or a path that would double up
 * against the paths callers append.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { academiaBaseUrl } from "../../../../convex/model/publicUrls";

const ACADEMIA = "https://academia.zephyraconsultora.com";
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.ZEPHYRA_ACADEMIA_URL;
  delete process.env.ZEPHYRA_PUBLIC_URL;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("academiaBaseUrl", () => {
  it("returns ZEPHYRA_ACADEMIA_URL when set", () => {
    process.env.ZEPHYRA_ACADEMIA_URL = ACADEMIA;
    expect(academiaBaseUrl()).toBe(ACADEMIA);
  });

  it("trims trailing slashes so callers can concatenate a path", () => {
    process.env.ZEPHYRA_ACADEMIA_URL = `${ACADEMIA}///`;
    expect(academiaBaseUrl()).toBe(ACADEMIA);
    expect(`${academiaBaseUrl()}/cursos/x/player`).toBe(
      `${ACADEMIA}/cursos/x/player`
    );
  });

  it("prefers ZEPHYRA_ACADEMIA_URL over the deprecated ZEPHYRA_PUBLIC_URL alias", () => {
    process.env.ZEPHYRA_ACADEMIA_URL = ACADEMIA;
    process.env.ZEPHYRA_PUBLIC_URL = "https://stale.example.com";
    expect(academiaBaseUrl()).toBe(ACADEMIA);
  });

  it("still honours ZEPHYRA_PUBLIC_URL alone (the shared dev deployment sets only this)", () => {
    // Removing this branch is an M6 action item (T-be-015): the dev deployment
    // defines ZEPHYRA_PUBLIC_URL and nothing else, so dropping the alias in this
    // task would have broken the dev money path immediately.
    process.env.ZEPHYRA_PUBLIC_URL = "https://staging-zephyra.vercel.app/";
    expect(academiaBaseUrl()).toBe("https://staging-zephyra.vercel.app");
  });

  it("THROWS naming the variable when neither is set — never returns the apex", () => {
    expect(() => academiaBaseUrl()).toThrow(/ZEPHYRA_ACADEMIA_URL/);
    // The exact fallback that M4 removed. If this ever passes, the regression is
    // a paying B2B buyer landing on apex/empresa/compra/exito, which 404s.
    expect(() => academiaBaseUrl()).not.toThrow(/^$/);
    try {
      academiaBaseUrl();
      throw new Error("expected academiaBaseUrl to throw");
    } catch (e) {
      expect((e as Error).message).not.toContain(
        "https://zephyraconsultora.com/"
      );
    }
  });

  it("treats a blank value as unset (an empty Convex env var must not win)", () => {
    process.env.ZEPHYRA_ACADEMIA_URL = "   ";
    expect(() => academiaBaseUrl()).toThrow(/ZEPHYRA_ACADEMIA_URL/);
  });

  it("rejects a value carrying a path, which would double up on concatenation", () => {
    process.env.ZEPHYRA_ACADEMIA_URL = `${ACADEMIA}/cursos`;
    expect(() => academiaBaseUrl()).toThrow(/absolute origin with no path/);
  });

  it("rejects a bare host with no scheme", () => {
    process.env.ZEPHYRA_ACADEMIA_URL = "academia.zephyraconsultora.com";
    expect(() => academiaBaseUrl()).toThrow(/absolute origin with no path/);
  });
});
