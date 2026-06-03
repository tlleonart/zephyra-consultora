import { redirect } from "next/navigation";
import { getSession } from "@/features/auth/lib/session";
import { LmsCourseList } from "./LmsCourseList";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "LMS - Zephyra Consultora",
};

// Admin LMS landing page.
// Protected by the existing admin auth (same middleware matcher + (dashboard)
// layout session guard as the other admin sub-routes).
export default async function AdminLmsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return <LmsCourseList />;
}
