import { redirect } from "next/navigation";
import { getSession } from "@/features/auth/lib/session";
import { LmsCourseList } from "./LmsCourseList";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "LMS - Zephyra Consultora",
};

// Admin LMS landing page.
// Protected by the existing admin auth (same middleware matcher + (dashboard)
// layout session guard as the other admin sub-routes). Reads the session
// server-side and props the adminUsers id down so the client mirrors the
// argument-based gating pattern already standard across the codebase.
export default async function AdminLmsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return <LmsCourseList userId={session.userId} />;
}
