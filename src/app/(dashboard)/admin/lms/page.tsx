import { redirect } from "next/navigation";
import { getSession } from "@/features/auth/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "LMS - Zephyra Consultora",
};

// Admin LMS landing page.
// Scaffolded in Sprint 0 (Phase A). Protected by the existing admin auth:
// the /admin/lms path is covered by the same middleware matcher + the
// (dashboard) layout session guard as the other 10 admin sub-routes.
// The SCORM ingest UI + course management land in later phases / Sprint 1.
export default async function AdminLmsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <section style={{ padding: "2rem" }}>
      <h1>LMS</h1>
      <p>
        Sección de gestión del LMS en construcción. Acá vas a poder ingestar
        cursos SCORM y administrar el catálogo de formación.
      </p>
    </section>
  );
}
