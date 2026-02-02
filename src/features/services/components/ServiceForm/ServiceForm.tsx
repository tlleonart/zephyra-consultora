'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import { Id } from '../../../../../convex/_generated/dataModel';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card';
import { IconPicker } from '@/components/ui/IconPicker';
import { useToast } from '@/providers/ToastProvider';
import styles from './ServiceForm.module.css';

interface ServiceFormProps {
  mode: 'create' | 'edit';
  initialData?: {
    _id: Id<'services'>;
    title: string;
    description: string;
    iconName: string;
    isActive: boolean;
  };
}

export const ServiceForm = ({ mode, initialData }: ServiceFormProps) => {
  const router = useRouter();
  const { success, error } = useToast();

  const createService = useMutation(api.services.create);
  const updateService = useMutation(api.services.update);

  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [iconName, setIconName] = useState(initialData?.iconName || 'lightbulb');
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = 'El título es requerido';
    if (!description.trim()) newErrors.description = 'La descripción es requerida';
    if (!iconName) newErrors.iconName = 'Selecciona un icono';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      if (mode === 'create') {
        await createService({
          title,
          description,
          iconName,
          isActive,
        });
        success('Servicio creado correctamente');
      } else if (initialData) {
        await updateService({
          id: initialData._id,
          title,
          description,
          iconName,
          isActive,
        });
        success('Servicio actualizado correctamente');
      }
      router.push('/admin/services');
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
          title={mode === 'create' ? 'Nuevo servicio' : 'Editar servicio'}
          description="Completa la información del servicio"
        />
        <CardContent>
          <div className={styles.grid}>
            <div className={styles.iconSection}>
              <IconPicker
                label="Icono"
                value={iconName}
                onChange={setIconName}
                error={errors.iconName}
              />

              <div className={styles.iconPreview}>
                <span className="material-icons">{iconName}</span>
                <span className={styles.iconName}>{iconName}</span>
              </div>
            </div>

            <div className={styles.fieldsSection}>
              <Input
                label="Título del servicio"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                error={errors.title}
                required
              />

              <div className={styles.field}>
                <label className={styles.label}>
                  Descripción
                  <span className={styles.required}>*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={styles.textarea}
                  rows={4}
                  placeholder="Describe el servicio en detalle..."
                />
                {errors.description && (
                  <span className={styles.error}>{errors.description}</span>
                )}
              </div>

              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span>Servicio activo</span>
              </label>
              <p className={styles.hint}>
                Solo los servicios activos se muestran en el sitio público.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push('/admin/services')}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            {mode === 'create' ? 'Crear servicio' : 'Guardar cambios'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
};
