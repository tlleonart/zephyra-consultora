import { redirect } from "next/navigation";
import { getSession } from "@/features/auth/lib/session";
import { EditCourseContent } from "./EditCourseContent";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Editar curso LMS - Zephyra Consultora",
};

// E03 (AC-E03.8): admin-only course meta edit page. Mirrors the blog edit
// page pattern — server component reads the session and props the slug +
// adminUsers id into a client component that fetches the row via
// getBySlugAdmin (admins can see drafts/archived).
export default async function EditLmsCoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const { slug } = await params;
  return <EditCourseContent userId={session.userId} slug={slug} />;
}
