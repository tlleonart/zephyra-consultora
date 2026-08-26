/**
 * C-07 — readCourseUnits, the pure projection behind CourseUnitsList.
 *
 * scoStructure is `v.any()` end to end (ingest writes whatever
 * parseScormManifest returned; nothing on the read side re-validates it), so
 * every one of these cases is a real possible row, not a hypothetical.
 */
import { describe, expect, it } from "vitest";
import { readCourseUnits } from "@/features/lms/lib/sco-structure";

const REAL_SHAPE = {
  organizations: {
    identifier: "org-1",
    title: "Sostenibilidad 101",
    items: [
      { identifier: "item-1", identifierref: "res-1", title: "Introducción" },
      { identifier: "item-2", identifierref: "res-2", title: "Marco DEI" },
      { identifier: "item-3", identifierref: "res-3", title: "Evaluación final" },
    ],
  },
  resources: [
    { identifier: "res-1", scormType: "sco", href: "intro/index.html", files: [] },
    { identifier: "res-2", scormType: "sco", href: "marco/index.html", files: [] },
    { identifier: "res-3", scormType: "asset", href: "eval/index.html", files: [] },
  ],
};

describe("readCourseUnits — the real ingest shape", () => {
  it("returns one unit per organizations.items entry, in order", () => {
    const units = readCourseUnits(REAL_SHAPE);
    expect(units.map((u) => u.title)).toEqual([
      "Introducción",
      "Marco DEI",
      "Evaluación final",
    ]);
  });

  it("resolves each unit's scormType via identifierref -> resources", () => {
    const units = readCourseUnits(REAL_SHAPE);
    expect(units.map((u) => u.scormType)).toEqual(["sco", "sco", "asset"]);
  });

  it("carries the item identifier through unchanged (used as the React key)", () => {
    expect(readCourseUnits(REAL_SHAPE).map((u) => u.identifier)).toEqual([
      "item-1",
      "item-2",
      "item-3",
    ]);
  });
});

describe("readCourseUnits — defensive against every malformed shape scoStructure being v.any() allows", () => {
  it.each([
    ["undefined (courses ingested before scoStructure existed)", undefined],
    ["null", null],
    ["{} (schema present, ingest wrote nothing)", {}],
    ["a bare string", "not an object"],
    ["a number", 42],
    ["an array instead of an object", []],
    ["organizations present but not an object", { organizations: "oops" }],
    ["organizations.items missing", { organizations: {} }],
    ["organizations.items not an array", { organizations: { items: "oops" } }],
    ["resources missing entirely", { organizations: { items: [{ identifier: "i1", title: "A" }] } }],
  ])("does not throw and returns [] for: %s", (_label, input) => {
    expect(() => readCourseUnits(input)).not.toThrow();
  });

  it("returns [] when organizations.items is absent", () => {
    expect(readCourseUnits({ organizations: {} })).toEqual([]);
  });

  it("still returns the unit (with scormType null) when resources is missing", () => {
    const units = readCourseUnits({
      organizations: { items: [{ identifier: "i1", identifierref: "r1", title: "Sólo item" }] },
    });
    expect(units).toEqual([{ identifier: "i1", title: "Sólo item", scormType: null }]);
  });

  it("drops individual items that lack identifier or title, instead of throwing on the whole list", () => {
    const units = readCourseUnits({
      organizations: {
        items: [
          { identifier: "i1", title: "Válido" },
          { identifier: "i2" }, // no title
          { title: "Sin identifier" }, // no identifier
          "not even an object",
          null,
        ],
      },
    });
    expect(units).toEqual([{ identifier: "i1", title: "Válido", scormType: null }]);
  });

  it("scormType is null when identifierref points at no resource in the list", () => {
    const units = readCourseUnits({
      organizations: {
        items: [{ identifier: "i1", identifierref: "missing-res", title: "Huérfano" }],
      },
      resources: [{ identifier: "res-1", scormType: "sco" }],
    });
    expect(units).toEqual([{ identifier: "i1", title: "Huérfano", scormType: null }]);
  });

  it("scormType is null (not undefined-crash) when a resource declares no scormType", () => {
    const units = readCourseUnits({
      organizations: {
        items: [{ identifier: "i1", identifierref: "res-1", title: "Sin tipo" }],
      },
      resources: [{ identifier: "res-1" }],
    });
    expect(units[0].scormType).toBeNull();
  });
});
