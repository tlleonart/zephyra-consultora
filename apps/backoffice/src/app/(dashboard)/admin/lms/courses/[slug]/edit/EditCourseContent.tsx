"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@zephyra/convex/_generated/api";
import type { Id } from "@zephyra/convex/_generated/dataModel";
import { CourseMetaForm } from "./CourseMetaForm";
import { CourseUnitsList } from "./CourseUnitsList";

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
    <>
      <CourseMetaForm
        userId={userId}
        course={{
          _id: course._id,
          title: course.title,
          slug: course.slug,
          status: course.status,
          description: course.description,
          coverStorageId: course.coverStorageId,
          priceUsd: course.priceUsd,
          isPurchasable: course.isPurchasable,
        }}
      />
      {/* C-07: read-only, derived from scoStructure — see CourseUnitsList's
          own header comment for why this is a sibling component rather than a
          section inside CourseMetaForm. Padding mirrors the form's own
          `padding: "2rem"` (top already supplied by the form above it). */}
      <div style={{ padding: "0 2rem 2rem" }}>
        <CourseUnitsList scoStructure={course.scoStructure} />
      </div>
    </>
  );
}
