import { notFound } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";
import { ScormPlayer } from "./ScormPlayer";

export const dynamic = "force-dynamic";

/**
 * SCORM player page (Phase D — AC-D02.1).
 *
 * Server-side: load the course by slug. The placeholder spike enrollment is
 * ensured client-side (a mutation can't run during server render), so the
 * client component calls ensureSpikeEnrollment on mount.
 */
export default async function PlayerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const course = await convex.query(api.lms.courses.getBySlug, { slug });
  if (!course) {
    notFound();
  }

  // Build the ordered list of launchable SCO items (item -> resource href).
  const structure = (course.scoStructure ?? {}) as {
    organizations?: {
      title?: string;
      items?: { identifier: string; identifierref: string | null; title: string }[];
    };
    resources?: { identifier: string; href: string | null; scormType: string | null }[];
  };
  const resources = structure.resources ?? [];
  const items = (structure.organizations?.items ?? [])
    .map((it) => {
      const res = resources.find((r) => r.identifier === it.identifierref);
      return res?.href ? { title: it.title, href: res.href } : null;
    })
    .filter((x): x is { title: string; href: string } => x !== null);

  return (
    <ScormPlayer
      courseId={course._id}
      slug={slug}
      courseTitle={course.title}
      entryPoint={course.entryPoint ?? items[0]?.href ?? null}
      units={items}
    />
  );
}
