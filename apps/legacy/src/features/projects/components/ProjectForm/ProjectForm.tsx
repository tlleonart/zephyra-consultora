'use client';

import { useState, FormEvent, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import { Id } from '../../../../../convex/_generated/dataModel';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { WysiwygEditor } from '@/features/blog/components/WysiwygEditor';
import { AchievementsList } from '../AchievementsList';
import { useToast } from '@/providers/ToastProvider';
import styles from './ProjectForm.module.css';

interface ProjectAchievement {
  _id: Id<'projectAchievements'>;
  description: string;
  displayOrder: number;
}

interface ProjectFormProps {
  mode: 'create' | 'edit';
  initialData?: {
    _id: Id<'projects'>;
    title: string;
    slug: string;
    excerpt: string;
    description: string;
    imageStorageId?: Id<'_storage'>;
    isFeatured: boolean;
    achievements: ProjectAchievement[];
  };
}

const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
};

export const ProjectForm = ({ mode, initialData }: ProjectFormProps) => {
  const router = useRouter();
  const { success, error } = useToast();

  const createProject = useMutation(api.projects.create);
  const updateProject = useMutation(api.projects.update);

  const [title, setTitle] = useState(initialData?.title || '');
  const [slug, setSlug] = useState(initialData?.slug || '');
  const [excerpt, setExcerpt] = useState(initialData?.excerpt || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [imageStorageId, setImageStorageId] = useState<Id<'_storage'> | null>(
    initialData?.imageStorageId || null
  );
  const [isFeatured, setIsFeatured] = useState(initialData?.isFeatured ?? false);
  const [achievements, setAchievements] = useState<string[]>(
    initialData?.achievements.map((a) => a.description) || []
  );
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const slugManuallyEdited = useRef(mode === 'edit');

  // Auto-generate slug from title in create mode
  useEffect(() => {
    if (mode === 'create' && !slugManuallyEdited.current) {
      setSlug(generateSlug(title));
    }
  }, [title, mode]);

  const handleSlugChange = (value: string) => {
    slugManuallyEdited.current = true;
    // Sanitize: only allow lowercase, numbers, hyphens
    const sanitized = value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .substring(0, 100);
    setSlug(sanitized);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = 'El título es requerido';
    if (!excerpt.trim()) newErrors.excerpt = 'El extracto es requerido';
    if (!description.trim()) newErrors.description = 'La descripción es requerida';
    if (!slug.trim()) newErrors.slug = 'El slug es requerido';
    if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      newErrors.slug = 'Solo minúsculas, números y guiones (sin guiones al inicio/final)';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      if (mode === 'create') {
        await createProject({
          title,
          excerpt,
          description,
          imageStorageId: imageStorageId || undefined,
          isFeatured,
          achievements,
        });
        success('Proyecto creado correctamente');
      } else if (initialData) {
        await updateProject({
          id: initialData._id,
          title,
          slug,
          excerpt,
          description,
          imageStorageId: imageStorageId || undefined,
          isFeatured,
          achievements,
        });
        success('Proyecto actualizado correctamente');
      }
      router.push('/admin/projects');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al guardar';
      if (message.includes('slug')) {
        setErrors((prev) => ({ ...prev, slug: 'Ya existe un proyecto con este slug' }));
      } else {
        error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.mainContent}>
        <Card padding="lg">
          <Input
            label="Título del proyecto"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={errors.title}
            required
          />

          <div className={styles.field}>
            <Input
              label="Extracto"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              hint="Resumen breve que aparece en las tarjetas del proyecto"
              error={errors.excerpt}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Descripción completa
              <span className={styles.required}>*</span>
            </label>
            <WysiwygEditor
              content={description}
              onChange={setDescription}
            />
            {errors.description && (
              <span className={styles.error}>{errors.description}</span>
            )}
          </div>
        </Card>

        <Card padding="lg">
          <CardHeader
            title="Logros del proyecto"
            description="Lista los logros o resultados destacados del proyecto"
          />
          <CardContent>
            <AchievementsList
              achievements={achievements}
              onChange={setAchievements}
            />
          </CardContent>
        </Card>
      </div>

      <div className={styles.sidebar}>
        <Card>
          <CardHeader title="Publicación" />
          <CardContent>
            <div className={styles.sidebarField}>
              <Input
                label="Slug (URL)"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                hint={`/proyectos/${slug || '...'}`}
                error={errors.slug}
              />
            </div>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
              />
              <span>Destacar proyecto</span>
            </label>
            <p className={styles.hint}>
              Los proyectos destacados aparecen en la página principal.
            </p>
          </CardContent>
          <CardFooter className={styles.sidebarFooter}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push('/admin/projects')}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={loading}>
              {mode === 'create' ? 'Crear proyecto' : 'Guardar cambios'}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader title="Imagen del proyecto" />
          <CardContent>
            <ImageUpload
              value={imageStorageId}
              onChange={(id) => setImageStorageId(id)}
            />
          </CardContent>
        </Card>
      </div>
    </form>
  );
};
