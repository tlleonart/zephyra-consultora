"use client";

import { useState, SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "../../../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../../../convex/_generated/dataModel";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/Card";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { WysiwygEditor } from "@/features/blog/components/WysiwygEditor";
import { useToast } from "@/providers/ToastProvider";

/**
 * Course meta edit form (E03 — AC-E03.8).
 *
 * Edits the admin-controlled presentation copy: title, description (TipTap),
 * cover image. SCORM payload fields are intentionally NOT exposed here —
 * those only change via re-ingest (which triggers archive-on-duplicate).
 *
 * Mirrors the BlogForm patterns: useToast for feedback, ImageUpload + Convex
 * _storage for the cover, WysiwygEditor for HTML description.
 */
interface CourseMetaFormProps {
  userId: Id<"adminUsers">;
  course: {
    _id: Id<"lmsCourses">;
    title: string;
    slug: string;
    status: "draft" | "published" | "archived";
    description?: string;
    coverStorageId?: Id<"_storage">;
  };
}

export function CourseMetaForm({ userId, course }: CourseMetaFormProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const updateCourseMeta = useMutation(api.lms.courses.updateCourseMeta);

  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? "");
  const [coverStorageId, setCoverStorageId] = useState<Id<"_storage"> | null>(
    course.coverStorageId ?? null
  );
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "El título es requerido";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      await updateCourseMeta({
        userId,
        id: course._id,
        title: title.trim(),
        description: description.trim() || undefined,
        coverStorageId: coverStorageId ?? undefined,
      });
      success("Curso actualizado");
      router.push("/admin/lms");
    } catch (err) {
      error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 320px",
        gap: "24px",
        padding: "2rem",
      }}
    >
      <div>
        <Card padding="lg">
          <CardHeader title={`Editar curso — ${course.slug}`} />
          <CardContent>
            <Input
              label="Título"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={errors.title}
              required
            />
            <div style={{ marginTop: 16 }}>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>
                Descripción
              </label>
              <WysiwygEditor content={description} onChange={setDescription} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <Card>
          <CardHeader title="Estado" />
          <CardContent>
            <div style={{ fontSize: 14, color: "#6b7280" }}>
              <div>
                <strong>Estado actual:</strong> {course.status}
              </div>
              <div style={{ marginTop: 6 }}>
                <strong>Slug:</strong> <code>{course.slug}</code>
              </div>
              <p style={{ marginTop: 8, fontSize: 12 }}>
                El slug y el contenido SCORM no se editan acá. Para una nueva
                versión, reingestá el paquete desde &ldquo;Ingestar SCORM&rdquo;.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/admin/lms")}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={loading} onClick={handleSubmit}>
              Guardar cambios
            </Button>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader title="Imagen de portada" />
          <CardContent>
            <ImageUpload
              value={coverStorageId}
              onChange={(id) => setCoverStorageId(id)}
            />
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
