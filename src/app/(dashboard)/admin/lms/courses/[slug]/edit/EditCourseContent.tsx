"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../../../convex/_generated/dataModel";
import { CourseMetaForm } from "./CourseMetaForm";

interface EditCourseContentProps {
  userId: Id<"adminUsers">;
  slug: string;
}

export function EditCourseContent({ userId, slug }: EditCourseContentProps) {
  const router = useRouter();
  const course = useQuery(api.lms.courses.getBySlugAdmin, { userId, slug });

  if (course === undefined) {
    return <p style={{ padding: "2rem" }}>Cargando...</p>;
  }
  if (course === null) {
    router.push("/admin/lms");
    return null;
  }

  return (
    <CourseMetaForm
      userId={userId}
      course={{
        _id: course._id,
        title: course.title,
        slug: course.slug,
        status: course.status,
        description: course.description,
        coverStorageId: course.coverStorageId,
      }}
    />
  );
}
