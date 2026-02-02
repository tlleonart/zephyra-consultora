'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import { Id } from '../../../../../convex/_generated/dataModel';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card';
import { ImageUpload } from '@/components/ui/ImageUpload';
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

export const ProjectForm = ({ mode, initialData }: ProjectFormProps) => {
  const router = useRouter();
  const { success, error } = useToast();

  const createProject = useMutation(api.projects.create);
  const updateProject = useMutation(api.projects.update);

  const [title, setTitle] = useState(initialData?.title || '');
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

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = 'El título es requerido';
    if (!excerpt.trim()) newErrors.excerpt = 'El extracto es requerido';
    if (!description.trim()) newErrors.description = 'La descripción es requerida';
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
      error(err instanceof Error ? err.message : 'Error al guardar');
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
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={styles.textarea}
              rows={6}
              placeholder="Describe el proyecto en detalle..."
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
