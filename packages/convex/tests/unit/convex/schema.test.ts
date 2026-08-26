/**
 * Unit tests for convex/schema.ts — T-04 (Split-4 M-HOME): the `topic` field
 * and its supporting index on `lmsCourses`.
 *
 * Reads the schema's runtime validator/index metadata (the same shape Convex
 * itself compiles against) rather than re-parsing the source file, so these
 * assertions fail the moment the schema's actual runtime contract drifts —
 * not just its source text.
 *
 * Also fixes AC 8 (SPEC-HOME-ACADEMIA-2026-08-26.md §6): `ingestScormPackage`
 * must remain a Convex `action` whose args never gain a `topic` field. This
 * lives here (not in courses.test.ts) because it is a schema-contract guard,
 * not a behavioral test of the ingest pipeline — the two are unrelated
 * change surfaces and this repo's convention keeps them apart (see
 * tests/unit/convex/lms/*.test.ts vs this file).
 */
import { describe, it, expect } from "vitest";
import schema from "../../../convex/schema";
import { ingestScormPackage } from "../../../convex/lms/courses";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lmsCourses = (schema as any).tables.lmsCourses;

describe("schema.ts — lmsCourses.topic (T-04)", () => {
  it("is optional — additive, no backfill (spec §4.2)", () => {
    const field = lmsCourses.validator.json.value.topic;
    expect(field).toBeDefined();
    expect(field.optional).toBe(true);
  });

  it("is restricted to exactly the five approved slugs (spec §4.1) — no more, no fewer", () => {
    const field = lmsCourses.validator.json.value.topic;
    expect(field.fieldType.type).toBe("union");
    const slugs = field.fieldType.value.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (member: any) => member.value
    );
    expect(slugs.sort()).toEqual(
      [
        "diversidad-inclusion",
        "liderazgo",
        "sostenibilidad",
        "cultura-organizacional",
        "comunicacion",
      ].sort()
    );
    // Every member is a literal, not a loose v.string() — the taxonomy is
    // closed in code, not a free-form or editable value (spec §4.1).
    for (const member of field.fieldType.value) {
      expect(member.type).toBe("literal");
    }
  });

  it("does not silently widen other lmsCourses fields' optionality", () => {
    // Guard against a topic-field edit that accidentally touches a
    // neighboring field's shape (copy-paste risk given they sit adjacent).
    expect(lmsCourses.validator.json.value.description.optional).toBe(true);
    expect(lmsCourses.validator.json.value.status.optional).toBe(false);
  });
});

describe("schema.ts — lmsCourses indexes (T-04)", () => {
  const byDescriptor = (name: string) =>
    lmsCourses.indexes.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ix: any) => ix.indexDescriptor === name
    );

  it("adds by_status_topic on [status, topic] — status first, since every consumer of this index only ever looks at published courses", () => {
    const index = byDescriptor("by_status_topic");
    expect(index).toBeDefined();
    expect(index.fields).toEqual(["status", "topic"]);
  });

  it("published-courses-by-topic is queryable via withIndex without a full scan", () => {
    // Illustrative of the pattern Ronan should use for "published of topic X"
    // (contract snippet — see CONTRACT-TOPIC-FIELD-2026-08-26.md). Asserted
    // here structurally: the compound index covers both equality predicates
    // the query needs, so no `.filter()` fallback is required.
    const index = byDescriptor("by_status_topic");
    expect(index.fields).toContain("status");
    expect(index.fields).toContain("topic");
  });

  it("does not remove or reshape the pre-existing lmsCourses indexes (AC 6 — nothing existing breaks)", () => {
    expect(byDescriptor("by_campus_course_id").fields).toEqual([
      "campusCourseId",
    ]);
    expect(byDescriptor("by_slug").fields).toEqual(["slug"]);
    expect(byDescriptor("by_status").fields).toEqual(["status"]);
    expect(byDescriptor("by_deleted").fields).toEqual(["deletedAt"]);
  });
});

describe("ingestScormPackage — AC 8 guard: the ingest action does not gain topic", () => {
  it("is still a Convex action, not a mutation", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn = ingestScormPackage as any;
    expect(fn.isAction).toBe(true);
    expect(fn.isMutation).toBeUndefined();
    expect(fn.isQuery).toBeUndefined();
  });

  it("its args validator has no `topic` field and is unchanged from the pre-T-04 shape", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn = ingestScormPackage as any;
    const args = JSON.parse(fn.exportArgs());
    expect(args.type).toBe("object");
    expect(Object.keys(args.value).sort()).toEqual(
      ["userId", "campusCourseId", "title", "files"].sort()
    );
    expect(args.value.topic).toBeUndefined();
  });
});
