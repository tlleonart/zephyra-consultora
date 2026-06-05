import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ConvexHttpClient } from "convex/browser";
import { getLearnerSession } from "@/features/auth-learner/lib/session";
import { api } from "../../../../../../convex/_generated/api";
import { ScormPlayer } from "./ScormPlayer";

export const dynamic = "force-dynamic";

/**
 * SCORM player page (D01 — learner identity migration).
 *
 * AUTH: middleware (C04) gates the route on the session-learner cookie. We
 * also call getLearnerSession() here for defense-in-depth (and to pass
 * learnerId into the player). No admin getSession() — Sprint-0 spike of admin
 * masquerade is gone.
 *
 * ACCESS GATE: after the learner is identified, we call getMyEnrollment to
 * confirm the learner actually has an active enrollment for this course.
 * Without an enrollment we render an explicit "no tenés acceso" page; we do
 * NOT auto-enroll (the placeholder ensureSpikeEnrollment is gone, by design).
 */
export default async function PlayerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const session = await getLearnerSession();
  if (!session) {
    redirect(
      `/cursos/auth/signin?returnTo=/cursos/${encodeURIComponent(slug)}/player`
    );
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  // getBySlug is PUBLIC + published-only; admin must publish the course before
  // launching the player.
  const course = await convex.query(api.lms.courses.getBySlug, { slug });
  if (!course) {
    notFound();
  }

  // Access gate: no enrollment, no player. Renders an explicit "no tenés
  // acceso" surface rather than a generic 404 so the learner knows the course
  // exists and how to request access.
  const enrollment = await convex.query(api.lms.enrollments.getMyEnrollment, {
    learnerId: session.learnerId,
    courseId: course._id,
  });

  if (!enrollment) {
    return (
      <div
        style={{
          maxWidth: 560,
          margin: "120px auto",
          padding: "40px 24px",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontSize: 24, marginBottom: 12 }}>
          No tenés acceso a este curso
        </h1>
        <p style={{ color: "#555", marginBottom: 24 }}>
          {course.title} existe, pero tu cuenta todavía no fue habilitada.
          Contactá al equipo de Zephyra para que te den acceso.
        </p>
        <Link
          href="/cursos"
          style={{
            display: "inline-block",
            padding: "10px 18px",
            background: "#2d7",
            color: "#fff",
            borderRadius: 6,
            textDecoration: "none",
          }}
        >
          Ver catálogo
        </Link>
      </div>
    );
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
      learnerId={session.learnerId}
      courseId={course._id}
      enrollmentId={enrollment._id}
      slug={slug}
      courseTitle={course.title}
      entryPoint={course.entryPoint ?? items[0]?.href ?? null}
      units={items}
    />
  );
}
