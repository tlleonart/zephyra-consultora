'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import { Id } from '../../../../../convex/_generated/dataModel';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { WysiwygEditor } from '../WysiwygEditor';
import { useToast } from '@/providers/ToastProvider';
import styles from './BlogForm.module.css';

interface BlogFormProps {
  mode: 'create' | 'edit';
  initialData?: {
    _id: Id<'blogPosts'>;
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    coverStorageId?: Id<'_storage'>;
    authorId: Id<'teamMembers'>;
    status: 'draft' | 'published';
  };
}

export const BlogForm = ({ mode, initialData }: BlogFormProps) => {
  const router = useRouter();
  const { success, error } = useToast();

  const teamMembers = useQuery(api.teamMembers.listForSelect);
  const createPost = useMutation(api.blogPosts.create);
  const updatePost = useMutation(api.blogPosts.update);

  const [title, setTitle] = useState(initialData?.title || '');
  const [excerpt, setExcerpt] = useState(initialData?.excerpt || '');
  const [content, setContent] = useState(initialData?.content || '');
  const [coverStorageId, setCoverStorageId] = useState<Id<'_storage'> | null>(
    initialData?.coverStorageId || null
  );
  const [authorId, setAuthorId] = useState<Id<'teamMembers'> | ''>(
    initialData?.authorId || ''
  );
  const [status, setStatus] = useState<'draft' | 'published'>(
    initialData?.status || 'draft'
  );
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = 'El título es requerido';
    if (!excerpt.trim()) newErrors.excerpt = 'El extracto es requerido';
    if (!content.trim()) newErrors.content = 'El contenido es requerido';
    if (!authorId) newErrors.authorId = 'Selecciona un autor';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent, saveStatus: 'draft' | 'published' = status) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      if (mode === 'create') {
        await createPost({
          title,
          excerpt,
          content,
          coverStorageId: coverStorageId || undefined,
          authorId: authorId as Id<'teamMembers'>,
          status: saveStatus,
        });
        success(saveStatus === 'published' ? 'Artículo publicado' : 'Borrador guardado');
      } else if (initialData) {
        await updatePost({
          id: initialData._id,
          title,
          excerpt,
          content,
          coverStorageId: coverStorageId || undefined,
          authorId: authorId as Id<'teamMembers'>,
        });
        success('Artículo actualizado');
      }
      router.push('/admin/blog');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  const authorOptions = (teamMembers || []).map((member) => ({
    value: member._id,
    label: `${member.name} (${member.role})`,
  }));

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.mainContent}>
        <Card padding="lg">
          <Input
            label="Título"
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
              hint="Resumen breve que aparece en los listados"
              error={errors.excerpt}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Contenido
              <span className={styles.required}>*</span>
            </label>
            <WysiwygEditor
              content={content}
              onChange={setContent}
            />
            {errors.content && (
              <span className={styles.error}>{errors.content}</span>
            )}
          </div>
        </Card>
      </div>

      <div className={styles.sidebar}>
        <Card>
          <CardHeader title="Publicación" />
          <CardContent>
            <div className={styles.sidebarField}>
              <Select
                label="Autor"
                value={authorId}
                onChange={(e) => setAuthorId(e.target.value as Id<'teamMembers'>)}
                options={authorOptions}
                placeholder="Selecciona un autor"
                error={errors.authorId}
                required
              />
            </div>

            {mode === 'edit' && (
              <div className={styles.statusInfo}>
                <span className={styles.statusLabel}>Estado actual:</span>
                <span className={`${styles.statusBadge} ${initialData?.status === 'published' ? styles.published : styles.draft}`}>
                  {initialData?.status === 'published' ? 'Publicado' : 'Borrador'}
                </span>
              </div>
            )}
          </CardContent>
          <CardFooter className={styles.sidebarFooter}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push('/admin/blog')}
            >
              Cancelar
            </Button>
            {mode === 'create' ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={(e) => handleSubmit(e as any, 'draft')}
                  loading={loading}
                >
                  Guardar borrador
                </Button>
                <Button
                  type="button"
                  onClick={(e) => handleSubmit(e as any, 'published')}
                  loading={loading}
                >
                  Publicar
                </Button>
              </>
            ) : (
              <Button type="submit" loading={loading}>
                Guardar cambios
              </Button>
            )}
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
};
