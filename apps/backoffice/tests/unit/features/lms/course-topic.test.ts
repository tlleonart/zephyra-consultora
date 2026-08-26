/**
 * T-05 — CourseMetaForm's topic selector, the decision logic pulled out into
 * features/lms/lib/course-topic.ts precisely so this is unit-testable (this
 * workspace's vitest runs `environment: "node"`, no jsdom — see
 * tests/vitest.config.ts — so a component-render test is not an option;
 * same shape as resolveImagePreview.test.ts / academiaLinks.test.ts).
 *
 * AC 7 (SPEC-HOME-ACADEMIA-2026-08-26.md §6): Zephyra assigns, changes, and
 * quits a course's topic from the panel — three paths. The first two are
 * the ones anybody would notice if they broke; the third — quitar, "" ->
 * undefined — is the silent one: no test in the 631-test base before this
 * task exercised it, and it is exactly the path that clears the column.
 */
import { describe, expect, it } from "vitest";
import { LMS_TOPIC_LABELS } from "@zephyra/utils";
import {
  NO_TOPIC,
  resolveTopicArg,
  seedTopicField,
  TOPIC_OPTIONS,
} from "@/features/lms/lib/course-topic";

describe("resolveTopicArg — the three paths AC 7 requires", () => {
  it("asignar: a real slug passes through unchanged", () => {
    expect(resolveTopicArg("liderazgo")).toBe("liderazgo");
  });

  it("cambiar: switching from one real slug to another just passes the new one through", () => {
    // Modeled as a sequence, the way CourseMetaForm's state actually moves:
    // the selector holds whatever the admin picked last, and each submit
    // calls resolveTopicArg on the CURRENT value only.
    expect(resolveTopicArg("liderazgo")).toBe("liderazgo");
    expect(resolveTopicArg("sostenibilidad")).toBe("sostenibilidad");
  });

  it('quitar: NO_TOPIC ("") becomes undefined — this is what unassigns the column', () => {
    expect(resolveTopicArg(NO_TOPIC)).toBeUndefined();
    expect(resolveTopicArg("")).toBeUndefined();
  });

  it("the full assign -> change -> quitar sequence, exactly as three consecutive submits would produce it", () => {
    const submitted: (string | undefined)[] = [];
    submitted.push(resolveTopicArg("liderazgo")); // assign
    submitted.push(resolveTopicArg("comunicacion")); // change
    submitted.push(resolveTopicArg(NO_TOPIC)); // quitar
    expect(submitted).toEqual(["liderazgo", "comunicacion", undefined]);
  });

  it("every real slug in the taxonomy round-trips through resolveTopicArg unchanged", () => {
    for (const slug of Object.keys(LMS_TOPIC_LABELS)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(resolveTopicArg(slug as any)).toBe(slug);
    }
  });
});

describe("AC 6 — a course with no topic today opens and saves without changing anything else", () => {
  it("seedTopicField lands course.topic === undefined on NO_TOPIC, not on a real slug", () => {
    // course.topic is undefined for every course that predates this task.
    expect(seedTopicField(undefined)).toBe(NO_TOPIC);
  });

  it("...and saving without touching the selector resolves back to undefined — a genuine no-op on the topic column", () => {
    const seeded = seedTopicField(undefined);
    expect(resolveTopicArg(seeded)).toBeUndefined();
  });

  it("a course that already has a topic seeds the selector on that slug, unchanged", () => {
    expect(seedTopicField("cultura-organizacional")).toBe(
      "cultura-organizacional"
    );
  });
});

describe("TOPIC_OPTIONS — the selector's five real slugs plus sin asignar", () => {
  it('starts with the "sin asignar" option, value NO_TOPIC', () => {
    expect(TOPIC_OPTIONS[0]).toEqual({ value: NO_TOPIC, label: "Sin asignar" });
  });

  it("carries exactly the taxonomy's slugs after that, sourced from LMS_TOPIC_LABELS — never hand-typed", () => {
    const expected = [
      { value: NO_TOPIC, label: "Sin asignar" },
      ...Object.entries(LMS_TOPIC_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    ];
    expect(TOPIC_OPTIONS).toEqual(expected);
  });

  it("has no duplicate values and no blank labels", () => {
    const values = TOPIC_OPTIONS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
    for (const option of TOPIC_OPTIONS) {
      expect(option.label.trim().length).toBeGreaterThan(0);
    }
  });

  it('never contains a literal "otros" or "sin-asignar" slug — absence, not a value, is the contract', () => {
    const values = TOPIC_OPTIONS.map((o) => o.value);
    expect(values).not.toContain("otros");
    expect(values).not.toContain("sin-asignar");
  });
});
