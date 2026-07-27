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
import styles from './AllianceForm.module.css';

interface AllianceFormProps {
  mode: 'create' | 'edit';
  initialData?: {
    _id: Id<'alliances'>;
    name: string;
    logoStorageId?: Id<'_storage'>;
    websiteUrl?: string;
  };
}

export const AllianceForm = ({ mode, initialData }: AllianceFormProps) => {
  const router = useRouter();
  const { success, error } = useToast();

  const createAlliance = useMutation(api.alliances.create);
  const updateAlliance = useMutation(api.alliances.update);

  const [name, setName] = useState(initialData?.name || '');
  const [logoStorageId, setLogoStorageId] = useState<Id<'_storage'> | null>(
    initialData?.logoStorageId || null
  );
  const [websiteUrl, setWebsiteUrl] = useState(initialData?.websiteUrl || '');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'El nombre es requerido';
    if (websiteUrl && !isValidUrl(websiteUrl)) {
      newErrors.websiteUrl = 'Ingresa una URL válida';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      if (mode === 'create') {
        await createAlliance({
          name,
          logoStorageId: logoStorageId || undefined,
          websiteUrl: websiteUrl || undefined,
        });
        success('Alianza agregada correctamente');
      } else if (initialData) {
        await updateAlliance({
          id: initialData._id,
          name,
          logoStorageId: logoStorageId || undefined,
          websiteUrl: websiteUrl || undefined,
        });
        success('Alianza actualizada correctamente');
      }
      router.push('/admin/alliances');
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
          title={mode === 'create' ? 'Agregar alianza' : 'Editar alianza'}
          description="Agrega un logo de alianza estratégica"
        />
        <CardContent>
          <div className={styles.grid}>
            <div className={styles.logoSection}>
              <ImageUpload
                label="Logo de la alianza"
                value={logoStorageId}
                onChange={(id) => setLogoStorageId(id)}
              />
              <p className={styles.hint}>
                Recomendado: PNG con fondo transparente
              </p>
            </div>

            <div className={styles.fieldsSection}>
              <Input
                label="Nombre de la alianza"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={errors.name}
                required
              />

              <Input
                label="Sitio web"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://www.ejemplo.com"
                hint="Opcional - El logo será enlazable a este sitio"
                error={errors.websiteUrl}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push('/admin/alliances')}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            {mode === 'create' ? 'Agregar alianza' : 'Guardar cambios'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
};
