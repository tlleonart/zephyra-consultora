import { redirect } from "next/navigation";
import { getSession } from "@/features/auth/lib/session";
import { ScormUploadForm } from "./ScormUploadForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ingestar curso SCORM - Zephyra Consultora",
};

// Admin SCORM ingestion page (Phase D — AC-D01.1).
// Auth-gated by the same pattern as the other admin sub-routes. The adminUsers
// id flows from the server-side session into the client form so the gated
// ingestScormPackage action receives it as an argument.
export default async function NewLmsCoursePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return <ScormUploadForm userId={session.userId} />;
}
