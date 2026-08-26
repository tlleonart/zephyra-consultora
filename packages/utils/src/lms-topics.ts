/**
 * Spanish labels for the LMS course topic taxonomy — the five slugs Zephyra
 * approved in Arena/direction C (SPEC-HOME-ACADEMIA-2026-08-26.md §4.1;
 * CONTRACT-TOPIC-FIELD-2026-08-26.md §3).
 *
 * Single shared home for these labels: apps/backoffice's CourseMetaForm
 * topic selector and apps/academia's home "Explorá por temática" chips both
 * read this map instead of each hand-writing the Spanish text — the failure
 * mode of not doing that is the two surfaces drifting apart silently (e.g.
 * one says "Diversidad e Inclusión", the other "Diversidad e inclusión").
 *
 * This does NOT feed Convex. The taxonomy itself — which 5 slugs are valid —
 * stays owned by packages/convex/convex/schema.ts's `lmsCourses.topic`
 * union; that remains the single source of truth Convex functions validate
 * against, and packages/convex deliberately does not depend on
 * @zephyra/utils (kept out of that package's dependency/bundle graph on
 * purpose). This map's keys are pinned to that same union — and to
 * @zephyra/convex's `TOPIC_SLUGS` (convex/lms/courses.ts) — by
 * apps/backoffice/tests/unit/shared/lmsTopicTaxonomy.test.ts, so the three
 * lists can't drift apart in silence.
 */
export const LMS_TOPIC_LABELS: Record<string, string> = {
  "diversidad-inclusion": "Diversidad e inclusión",
  liderazgo: "Liderazgo",
  sostenibilidad: "Sostenibilidad",
  "cultura-organizacional": "Cultura organizacional",
  comunicacion: "Comunicación",
};
