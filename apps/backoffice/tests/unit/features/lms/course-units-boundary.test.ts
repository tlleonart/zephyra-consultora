/**
 * C-07 — structural guard for the load-bearing premise: the course fiche may
 * SHOW the SCORM package's units, but must never let an admin EDIT them. The
 * package changes only via re-ingest (which triggers archive-on-duplicate);
 * habilitando edición acá sería una regresión de esa premisa, no una mejora.
 *
 * Source sweep (this workspace's vitest `environment` is `node`, no jsdom —
 * see tests/vitest.config.ts), same style as academiaLinks.test.ts's
 * source-invariant half.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const REPO = path.resolve(__dirname, "../../../../../..");
const read = (rel: string) => fs.readFileSync(path.join(REPO, rel), "utf8");

const EDIT_DIR = "apps/backoffice/src/app/(dashboard)/admin/lms/courses/[slug]/edit";
const UNITS_LIST = read(`${EDIT_DIR}/CourseUnitsList.tsx`);
const META_FORM = read(`${EDIT_DIR}/CourseMetaForm.tsx`);
const CONTENT = read(`${EDIT_DIR}/EditCourseContent.tsx`);

describe("CourseUnitsList carries no way to edit the SCORM structure it shows", () => {
  it("declares no mutation hook", () => {
    expect(UNITS_LIST).not.toMatch(/useMutation/);
  });

  it("renders no form, no input, no contenteditable", () => {
    expect(UNITS_LIST).not.toMatch(/<form/i);
    expect(UNITS_LIST).not.toMatch(/<input/i);
    expect(UNITS_LIST).not.toMatch(/contentEditable/);
  });

  it("carries no onChange/onSubmit handler", () => {
    expect(UNITS_LIST).not.toMatch(/onChange=|onSubmit=/);
  });
});

describe("CourseMetaForm still states the boundary this list respects", () => {
  it("keeps the \"intentionally NOT exposed\" comment — the premise this task must not contradict", () => {
    expect(META_FORM).toMatch(/intentionally NOT exposed/);
  });

  it("still has no SCORM-payload input of its own (scoStructure, entryPoint, manifest)", () => {
    expect(META_FORM).not.toMatch(/scoStructure/);
    expect(META_FORM).not.toMatch(/entryPoint/);
    expect(META_FORM).not.toMatch(/\bmanifest\b/i);
  });
});

describe("the edit page actually wires scoStructure into the read-only list", () => {
  it("imports CourseUnitsList", () => {
    expect(CONTENT).toMatch(/import\s*\{\s*CourseUnitsList\s*\}\s*from\s*['"]\.\/CourseUnitsList['"]/);
  });

  it("passes the course's own scoStructure — not a hardcoded/mock value", () => {
    expect(CONTENT).toMatch(/<CourseUnitsList\s+scoStructure=\{course\.scoStructure\}/);
  });
});
