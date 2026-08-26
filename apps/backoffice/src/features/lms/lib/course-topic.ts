import { LMS_TOPIC_LABELS } from "@zephyra/utils";

/**
 * T-05 — the CourseMetaForm topic selector's decision logic, pulled out of
 * the "use client" component so it is unit-testable: this workspace's vitest
 * runs `environment: "node"` with no jsdom (see tests/vitest.config.ts), so a
 * component-render test is not an option — same reasoning, same shape, as
 * resolveImagePreview (packages/ui) and features/lms/lib/academia-links.ts /
 * sco-structure.ts (the existing precedent: "pure LMS logic lives in lib/,
 * not inline in a .tsx file").
 *
 * Re-spelled from the same union updateCourseMeta / TOPIC_SLUGS / schema.ts
 * carry (packages/convex/convex/lms/courses.ts TOPIC_SLUGS comment: house
 * convention, same as setStatus's status union — not sourced from schema.ts
 * at runtime). Kept in lockstep with those three by
 * tests/unit/shared/lmsTopicTaxonomy.test.ts.
 */
export type TopicSlug =
  | "diversidad-inclusion"
  | "liderazgo"
  | "sostenibilidad"
  | "cultura-organizacional"
  | "comunicacion";

/** The selector's own sentinel for "sin asignar". Never sent to Convex as a
 *  value — see resolveTopicArg. Not "otros", not "sin-asignar": T-04
 *  contract §5 fixes "sin asignar" as the ABSENCE of the field, never a
 *  literal slug. */
export const NO_TOPIC = "" as const;

export type TopicFieldValue = TopicSlug | typeof NO_TOPIC;

/**
 * The selector's options, in the exact order LMS_TOPIC_LABELS declares them.
 * The Spanish text always comes from @zephyra/utils — never hand-typed here
 * — so this panel and the home's "Explorá por temática" chips can never say
 * two different things for the same slug (see LMS_TOPIC_LABELS's own doc
 * comment for the failure mode this avoids).
 */
export const TOPIC_OPTIONS: { value: string; label: string }[] = [
  { value: NO_TOPIC, label: "Sin asignar" },
  ...Object.entries(LMS_TOPIC_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

/**
 * Maps the selector's field value to what updateCourseMeta's `topic` arg
 * must carry — the ONE place this form decides assign vs. change vs. quitar:
 *
 *  - assign / change: any real slug passes through unchanged.
 *  - quitar: NO_TOPIC ("") becomes `undefined`, which is what unassigns the
 *    column. updateCourseMeta follows the same optional-field semantics
 *    description/coverStorageId already use — the form always resends its
 *    full state, so "field omitted from this call" and "field explicitly
 *    cleared" are the same call (see updateCourseMeta's own doc comment,
 *    packages/convex/convex/lms/courses.ts).
 */
export function resolveTopicArg(
  topic: TopicFieldValue
): TopicSlug | undefined {
  return topic === NO_TOPIC ? undefined : topic;
}

/**
 * The selector's initial value from a loaded course. AC 6: a course that
 * predates this field has `topic: undefined`, and this must land on
 * NO_TOPIC (not throw, not default to a real slug) — the selector opens on
 * "sin asignar", and saving without touching it round-trips back to
 * `undefined` via resolveTopicArg, a genuine no-op on the topic column.
 */
export function seedTopicField(topic: TopicSlug | undefined): TopicFieldValue {
  return topic ?? NO_TOPIC;
}
