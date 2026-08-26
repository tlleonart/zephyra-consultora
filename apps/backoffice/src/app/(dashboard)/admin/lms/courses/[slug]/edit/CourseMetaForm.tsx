"use client";

import { useState, SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@zephyra/convex/_generated/api";
import type { Id } from "@zephyra/convex/_generated/dataModel";
import { Input } from "@zephyra/ui";
import { Button } from "@zephyra/ui";
import { Card, CardHeader, CardContent, CardFooter } from "@zephyra/ui";
import { ImageUpload } from "@zephyra/ui";
import { Select } from "@zephyra/ui";
import { WysiwygEditor } from "@/features/blog/components/WysiwygEditor";
import { useToast } from "@zephyra/ui/providers/ToastProvider";
import {
  resolveTopicArg,
  seedTopicField,
  TOPIC_OPTIONS,
  TopicFieldValue,
  TopicSlug,
} from "@/features/lms/lib/course-topic";

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
    priceUsd?: number;
    isPurchasable?: boolean;
    topic?: TopicSlug;
  };
}

export function CourseMetaForm({ userId, course }: CourseMetaFormProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const updateCourseMeta = useMutation(api.lms.courses.updateCourseMeta);
  const updateCoursePricing = useMutation(api.lms.courses.updateCoursePricing);

  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? "");
  const [coverStorageId, setCoverStorageId] = useState<Id<"_storage"> | null>(
    course.coverStorageId ?? null
  );
  // Pricing (P1.4). priceUsd is held as a string so the input can be empty
  // mid-edit; parsed + validated on submit.
  const [priceUsd, setPriceUsd] = useState(
    typeof course.priceUsd === "number" ? String(course.priceUsd) : ""
  );
  const [isPurchasable, setIsPurchasable] = useState(
    course.isPurchasable === true
  );
  // seedTopicField maps course.topic ?? "sin asignar" (T-04 contract §5).
  // Cursos que hoy no tienen temática arrancan ahí, y guardar sin tocar el
  // selector reenvía ese sentinel -> undefined via resolveTopicArg, el mismo
  // no-op que description/coverStorageId ya hacen.
  const [topic, setTopic] = useState<TopicFieldValue>(
    seedTopicField(course.topic)
  );
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "El título es requerido";

    const parsedPrice = priceUsd.trim() === "" ? 0 : Number(priceUsd);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      next.priceUsd = "El precio debe ser un número mayor o igual a 0";
    } else if (isPurchasable && !(parsedPrice > 0)) {
      next.priceUsd =
        "Definí un precio mayor a 0 para habilitar la compra del curso";
    }

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
        topic: resolveTopicArg(topic),
      });
      await updateCoursePricing({
        userId,
        id: course._id,
        priceUsd: parsedPrice,
        isPurchasable,
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
            <div style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>
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
          <CardHeader title="Temática" />
          <CardContent>
            <Select
              label="Temática"
              value={topic}
              onChange={(e) => setTopic(e.target.value as TopicFieldValue)}
              options={TOPIC_OPTIONS}
            />
            <p style={{ marginTop: 8, fontSize: 12, color: "var(--color-text-secondary)" }}>
              Decide bajo qué chip aparece el curso en &ldquo;Explorá por
              temática&rdquo; en la home de Academia. &ldquo;Sin
              asignar&rdquo; lo deja fuera de todas las chips.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Precio y venta" />
          <CardContent>
            <Input
              label="Precio (USD)"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={priceUsd}
              onChange={(e) => setPriceUsd(e.target.value)}
              error={errors.priceUsd}
              placeholder="0"
            />
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 16,
                cursor: "pointer",
              }}
            >
              {/* WCAG 2.5.8 (AA): this one carried no sizing at all, so it
                  rendered at the UA default — the smallest of the six
                  checkboxes in the backoffice, not one of the 18px five. */}
              <input
                type="checkbox"
                checked={isPurchasable}
                onChange={(e) => setIsPurchasable(e.target.checked)}
                style={{ width: 24, height: 24 }}
              />
              <span style={{ fontWeight: 500 }}>
                Disponible para la venta
              </span>
            </label>
            <p style={{ marginTop: 8, fontSize: 12, color: "var(--color-text-secondary)" }}>
              Al habilitar la venta, el curso muestra el botón “Comprar” en el
              catálogo. El precio se cobra en USD (MercadoPago convierte a ARS
              en el checkout).
            </p>
          </CardContent>
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
