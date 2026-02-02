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
import styles from './TeamForm.module.css';

interface TeamFormProps {
  mode: 'create' | 'edit';
  initialData?: {
    _id: Id<'teamMembers'>;
    name: string;
    role: string;
    specialty: string;
    imageStorageId?: Id<'_storage'>;
    isVisible: boolean;
  };
}

export const TeamForm = ({ mode, initialData }: TeamFormProps) => {
  const router = useRouter();
  const { success, error } = useToast();

  const createMember = useMutation(api.teamMembers.create);
  const updateMember = useMutation(api.teamMembers.update);

  const [name, setName] = useState(initialData?.name || '');
  const [role, setRole] = useState(initialData?.role || '');
  const [specialty, setSpecialty] = useState(initialData?.specialty || '');
  const [imageStorageId, setImageStorageId] = useState<Id<'_storage'> | null>(
    initialData?.imageStorageId || null
  );
  const [isVisible, setIsVisible] = useState(initialData?.isVisible ?? true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'El nombre es requerido';
    if (!role.trim()) newErrors.role = 'El cargo es requerido';
    if (!specialty.trim()) newErrors.specialty = 'La especialidad es requerida';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      if (mode === 'create') {
        await createMember({
          name,
          role,
          specialty,
          imageStorageId: imageStorageId || undefined,
          isVisible,
        });
        success('Miembro creado correctamente');
      } else if (initialData) {
        await updateMember({
          id: initialData._id,
          name,
          role,
          specialty,
          imageStorageId: imageStorageId || undefined,
          isVisible,
        });
        success('Miembro actualizado correctamente');
      }
      router.push('/admin/team');
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
          title={mode === 'create' ? 'Nuevo miembro' : 'Editar miembro'}
          description="Completa la información del miembro del equipo"
        />
        <CardContent>
          <div className={styles.grid}>
            <div className={styles.imageSection}>
              <ImageUpload
                label="Foto"
                value={imageStorageId}
                onChange={(id) => setImageStorageId(id)}
              />
            </div>

            <div className={styles.fieldsSection}>
              <Input
                label="Nombre completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={errors.name}
                required
              />

              <Input
                label="Cargo"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Ej: Cofundadora, Consultora"
                error={errors.role}
                required
              />

              <Input
                label="Especialidad"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="Ej: Sostenibilidad corporativa"
                error={errors.specialty}
                required
              />

              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={(e) => setIsVisible(e.target.checked)}
                />
                <span>Visible en el sitio público</span>
              </label>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push('/admin/team')}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            {mode === 'create' ? 'Crear miembro' : 'Guardar cambios'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
};
