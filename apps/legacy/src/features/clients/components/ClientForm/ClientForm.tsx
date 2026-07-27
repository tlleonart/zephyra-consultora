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
import styles from './ClientForm.module.css';

interface ClientFormProps {
  mode: 'create' | 'edit';
  initialData?: {
    _id: Id<'clients'>;
    name: string;
    logoStorageId?: Id<'_storage'>;
    websiteUrl?: string;
  };
}

export const ClientForm = ({ mode, initialData }: ClientFormProps) => {
  const router = useRouter();
  const { success, error } = useToast();

  const createClient = useMutation(api.clients.create);
  const updateClient = useMutation(api.clients.update);

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
        await createClient({
          name,
          logoStorageId: logoStorageId || undefined,
          websiteUrl: websiteUrl || undefined,
        });
        success('Cliente agregado correctamente');
      } else if (initialData) {
        await updateClient({
          id: initialData._id,
          name,
          logoStorageId: logoStorageId || undefined,
          websiteUrl: websiteUrl || undefined,
        });
        success('Cliente actualizado correctamente');
      }
      router.push('/admin/clients');
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
          title={mode === 'create' ? 'Agregar cliente' : 'Editar cliente'}
          description="Agrega un logo de cliente para la sección de confianza"
        />
        <CardContent>
          <div className={styles.grid}>
            <div className={styles.logoSection}>
              <ImageUpload
                label="Logo del cliente"
                value={logoStorageId}
                onChange={(id) => setLogoStorageId(id)}
              />
              <p className={styles.hint}>
                Recomendado: PNG con fondo transparente
              </p>
            </div>

            <div className={styles.fieldsSection}>
              <Input
                label="Nombre del cliente"
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
            onClick={() => router.push('/admin/clients')}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            {mode === 'create' ? 'Agregar cliente' : 'Guardar cambios'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
};
