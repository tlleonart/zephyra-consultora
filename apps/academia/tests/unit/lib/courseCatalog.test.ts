/**
 * Pure-logic coverage for the shared card-assembly helpers (T-06/T-07,
 * M-HOME). `toCourseCardData`/`toCourseCards` need a ConvexHttpClient and
 * are exercised indirectly through the pages that call them; the
 * description/SCO-count resolution is pure and is pinned directly here.
 */
import { describe, it, expect } from "vitest";
import {
  deriveDescriptionFromSco,
  deriveScoCount,
  resolveCourseDescription,
} from "@/lib/course-catalog";

describe("deriveDescriptionFromSco", () => {
  it("uses the SCO organization title when it is long enough", () => {
    expect(
      deriveDescriptionFromSco({
        organizations: { title: "Diversidad, Equidad e Inclusión" },
      })
    ).toBe("Diversidad, Equidad e Inclusión");
  });

  it("falls back to the generic copy when there is no usable title", () => {
    expect(deriveDescriptionFromSco(undefined)).toBe(
      "Formación online a tu ritmo. Contenidos prácticos y aplicables."
    );
    expect(deriveDescriptionFromSco({ organizations: { title: "Curso" } })).toBe(
      "Formación online a tu ritmo. Contenidos prácticos y aplicables."
    );
  });
});

describe("resolveCourseDescription — T-07", () => {
  it("uses the written description, stripped of markup, when present", () => {
    const out = resolveCourseDescription({
      description: "<p>Marco conceptual y <strong>prácticas concretas</strong>.</p>",
      scoStructure: { organizations: { title: "Diversidad, Equidad e Inclusión" } },
    });
    expect(out).toBe("Marco conceptual y prácticas concretas.");
  });

  it("falls back to the SCO derivation when there is no description", () => {
    const out = resolveCourseDescription({
      scoStructure: { organizations: { title: "Diversidad, Equidad e Inclusión" } },
    });
    expect(out).toBe("Diversidad, Equidad e Inclusión");
  });

  it("falls back to the SCO derivation when the description is markup with no text", () => {
    const out = resolveCourseDescription({
      description: "<p></p>",
      scoStructure: { organizations: { title: "Diversidad, Equidad e Inclusión" } },
    });
    expect(out).toBe("Diversidad, Equidad e Inclusión");
  });

  it("never lets a raw tag reach the card", () => {
    const out = resolveCourseDescription({
      description: "<script>alert(1)</script><p>Texto real</p>",
    });
    expect(out).not.toMatch(/<[^>]+>/);
  });
});

describe("deriveScoCount", () => {
  it("counts only items whose resource is a real SCO", () => {
    const scoStructure = {
      organizations: {
        items: [
          { identifier: "i1", identifierref: "r1", title: "Uno" },
          { identifier: "i2", identifierref: "r2", title: "Dos" },
          { identifier: "i3", identifierref: "r3", title: "Asset only" },
        ],
      },
      resources: [
        { identifier: "r1", href: "a.html", scormType: "sco" },
        { identifier: "r2", href: "b.html", scormType: null },
        { identifier: "r3", href: "c.css", scormType: "asset" },
      ],
    };
    expect(deriveScoCount(scoStructure)).toBe(2);
  });

  it("returns 0 for missing/empty structure", () => {
    expect(deriveScoCount(undefined)).toBe(0);
    expect(deriveScoCount({})).toBe(0);
  });
});
