import { notFound, redirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { getSession } from "@/features/auth/lib/session";
import { api } from "../../../../../../convex/_generated/api";
import { ScormPlayer } from "./ScormPlayer";

export const dynamic = "force-dynamic";

/**
 * SCORM player page (Phase D — AC-D02.1).
 *
 * Server-side: load the course by slug. The placeholder spike enrollment is
 * ensured client-side (a mutation can't run during server render), so the
 * client component calls ensureSpikeEnrollment on mount.
 *
 * AUTH (B02): the player calls gated mutations (ensureSpikeEnrollment,
 * recordScormEvent), so the page itself requires a logged-in admin user.
 * Sprint-0 spike uses admin masquerading as learner; C04 will add a learner
 * middleware so non-admin learners can reach the player after seat-claim.
 */
export default async function PlayerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const session = await getSession();
  if (!session) {
    redirect(`/login?returnTo=/cursos/${encodeURIComponent(slug)}/player`);
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  // getBySlug is PUBLIC + published-only; admin must publish the course before
  // launching the player.
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
      userId={session.userId}
      courseId={course._id}
      slug={slug}
      courseTitle={course.title}
      entryPoint={course.entryPoint ?? items[0]?.href ?? null}
      units={items}
    />
  );
}
