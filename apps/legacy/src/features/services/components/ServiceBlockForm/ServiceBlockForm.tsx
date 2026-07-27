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
import { useToast } from '@/providers/ToastProvider';
import styles from './ServiceBlockForm.module.css';

interface ServiceBlockFormProps {
  mode: 'create' | 'edit';
  initialData?: {
    _id: Id<'serviceBlocks'>;
    title: string;
    subtitle: string;
    imageStorageId?: Id<'_storage'>;
    isActive: boolean;
  };
}

export const ServiceBlockForm = ({ mode, initialData }: ServiceBlockFormProps) => {
  const router = useRouter();
  const { success, error } = useToast();

  const createBlock = useMutation(api.serviceBlocks.create);
  const updateBlock = useMutation(api.serviceBlocks.update);

  const [title, setTitle] = useState(initialData?.title || '');
  const [subtitle, setSubtitle] = useState(initialData?.subtitle || '');
  const [imageStorageId, setImageStorageId] = useState<Id<'_storage'> | null>(
    initialData?.imageStorageId || null
  );
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = 'El titulo es requerido';
    if (!subtitle.trim()) newErrors.subtitle = 'El subtitulo es requerido';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      if (mode === 'create') {
        await createBlock({
          title,
          subtitle,
          imageStorageId: imageStorageId || undefined,
          isActive,
        });
        success('Bloque creado correctamente');
      } else if (initialData) {
        await updateBlock({
          id: initialData._id,
          title,
          subtitle,
          imageStorageId: imageStorageId || undefined,
          isActive,
        });
        success('Bloque actualizado correctamente');
      }
      router.push('/admin/service-blocks');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <Card>
        <CardHeader
          title={mode === 'create' ? 'Nuevo bloque' : 'Editar bloque'}
          description="Completa la informacion del bloque de servicios"
        />
        <CardContent>
          <div className={styles.grid}>
            <div className={styles.imageSection}>
              <ImageUpload
                label="Imagen del bloque"
                value={imageStorageId}
                onChange={(id) => setImageStorageId(id)}
                maxSizeMB={20}
              />
            </div>

            <div className={styles.fieldsSection}>
              <Input
                label="Titulo del bloque"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                error={errors.title}
                required
              />

              <div className={styles.field}>
                <label className={styles.label}>
                  Subtitulo
                  <span className={styles.required}>*</span>
                </label>
                <textarea
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className={styles.textarea}
                  rows={3}
                  placeholder="Describe brevemente el bloque..."
                />
                {errors.subtitle && (
                  <span className={styles.error}>{errors.subtitle}</span>
                )}
              </div>

              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span>Bloque activo</span>
              </label>
              <p className={styles.hint}>
                Solo los bloques activos se muestran en el sitio publico.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push('/admin/service-blocks')}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            {mode === 'create' ? 'Crear bloque' : 'Guardar cambios'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
};
