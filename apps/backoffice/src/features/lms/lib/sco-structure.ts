/**
 * scoStructure (C-07) — pure, defensive projection.
 *
 * scoStructure is stored as `v.optional(v.any())` (packages/convex/convex/
 * schema.ts) — ingestScormPackage writes whatever parseScormManifest returned
 * (packages/convex/convex/lms/manifest.ts:
 *   { organizations: { identifier, title, items }, resources }
 * ), but nothing on the READ side guarantees that shape survived: it is `any`
 * in the schema precisely because it is opaque payload, not a modelled type.
 * Extracted here (rather than inlined in the component that renders it) so
 * the defensive parsing is a plain function this workspace's `node`-only
 * vitest environment can exercise directly — mirrors
 * features/lms/lib/academia-links.ts, the existing precedent for "pure LMS
 * logic lives in lib/, not inline in a .tsx file", and this workspace has no
 * jsdom to render the component itself (see tests/vitest.config.ts).
 */
export interface CourseUnit {
  identifier: string;
  title: string;
  /** SCORM `scormType` ("sco" | "asset") of the resource this item launches,
   *  resolved via `identifierref`. null when absent or unresolvable. */
  scormType: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export function readCourseUnits(scoStructure: unknown): CourseUnit[] {
  if (!isRecord(scoStructure)) return [];

  const organizations = scoStructure.organizations;
  const items =
    isRecord(organizations) && Array.isArray(organizations.items)
      ? organizations.items
      : [];

  const resources = Array.isArray(scoStructure.resources) ? scoStructure.resources : [];
  const scormTypeByResourceId = new Map<string, string | null>();
  for (const resource of resources) {
    if (isRecord(resource) && typeof resource.identifier === "string") {
      scormTypeByResourceId.set(
        resource.identifier,
        typeof resource.scormType === "string" ? resource.scormType : null
      );
    }
  }

  return items
    .filter(
      (item): item is Record<string, unknown> =>
        isRecord(item) && typeof item.identifier === "string" && typeof item.title === "string"
    )
    .map((item) => {
      const ref = typeof item.identifierref === "string" ? item.identifierref : null;
      return {
        identifier: item.identifier as string,
        title: item.title as string,
        scormType: ref && scormTypeByResourceId.has(ref) ? scormTypeByResourceId.get(ref)! : null,
      };
    });
}
