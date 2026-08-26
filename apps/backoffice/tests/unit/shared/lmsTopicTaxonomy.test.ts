/**
 * M-HOME amendment (post T-05 review). The five LMS topic slugs are
 * re-spelled in three places on purpose (house convention — see
 * convex/lms/courses.ts's TOPIC_SLUGS comment, same pattern as setStatus's
 * status union): schema.ts's `lmsCourses.topic` v.union (the authority),
 * courses.ts's TOPIC_SLUGS + updateCourseMeta's args union (Convex-side
 * consumers), and @zephyra/utils's LMS_TOPIC_LABELS keys (the UI-side
 * consumer both apps' topic surfaces read).
 *
 * Nothing wires those together at compile time. The failure mode if they
 * drift is silent, not loud: add a 6th slug to schema.ts only, and
 * listPublishedByTopic returns [] for it forever — indistinguishable from
 * "this topic has zero published courses", which is exactly the state AC 4
 * ("chips don't lie") exists to render correctly. This test exists so that
 * drift fails here, loudly, instead of shipping as a home chip that quietly
 * never works.
 *
 * Lives in apps/backoffice (not packages/convex or packages/utils) because
 * it's the one workspace that depends on both @zephyra/convex and
 * @zephyra/utils (same reasoning as the C-01 fix's test — see
 * tests/unit/shared/resolveImagePreview.test.ts). packages/convex and
 * @zephyra/utils are read via relative filesystem imports here (not through
 * the "@zephyra/convex"/"@zephyra/utils" package names' export maps): this
 * is a test-only cross-package read, not a new runtime dependency edge —
 * packages/convex must NOT gain @zephyra/utils as a dependency (kept out of
 * Convex functions' bundle graph on purpose).
 */
import { describe, it, expect } from "vitest";
import schema from "../../../../../packages/convex/convex/schema";
import {
  TOPIC_SLUGS,
  updateCourseMeta,
} from "../../../../../packages/convex/convex/lms/courses";
import { LMS_TOPIC_LABELS } from "@zephyra/utils";

// Same runtime-metadata-reading pattern as
// packages/convex/tests/unit/convex/schema.test.ts (T-04): read the
// compiled validator, don't re-parse source text.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lmsCourses = (schema as any).tables.lmsCourses;

const EXPECTED = [
  "diversidad-inclusion",
  "liderazgo",
  "sostenibilidad",
  "cultura-organizacional",
  "comunicacion",
].sort();

describe("LMS topic taxonomy — schema.ts / courses.ts / @zephyra/utils stay in lockstep", () => {
  it("schema.ts's lmsCourses.topic union is exactly the five approved slugs", () => {
    const field = lmsCourses.validator.json.value.topic;
    const slugs = field.fieldType.value.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (member: any) => member.value
    );
    expect(slugs.sort()).toEqual(EXPECTED);
  });

  it("courses.ts's TOPIC_SLUGS (backs listPublishedByTopic's closed-set check) matches schema.ts exactly", () => {
    const field = lmsCourses.validator.json.value.topic;
    const schemaSlugs = field.fieldType.value
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((member: any) => member.value)
      .sort();
    expect([...TOPIC_SLUGS].sort()).toEqual(schemaSlugs);
    expect([...TOPIC_SLUGS].sort()).toEqual(EXPECTED);
  });

  it("updateCourseMeta's `topic` args validator matches schema.ts exactly — the panel can assign every slug that exists", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn = updateCourseMeta as any;
    const args = JSON.parse(fn.exportArgs());
    const topicUnion = args.value.topic.fieldType.value.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (member: any) => member.value
    );
    expect(topicUnion.sort()).toEqual(EXPECTED);
  });

  it("@zephyra/utils's LMS_TOPIC_LABELS has exactly one Spanish label per slug — no more, no fewer, none blank", () => {
    const keys = Object.keys(LMS_TOPIC_LABELS).sort();
    expect(keys).toEqual(EXPECTED);
    for (const slug of EXPECTED) {
      expect(typeof LMS_TOPIC_LABELS[slug]).toBe("string");
      expect(LMS_TOPIC_LABELS[slug].trim().length).toBeGreaterThan(0);
    }
  });
});
