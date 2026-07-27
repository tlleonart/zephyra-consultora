'use client';

import Link from 'next/link';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import { Id } from '../../../../../convex/_generated/dataModel';
import { Button } from '@/components/ui/Button';
import { Table, Column } from '@/components/ui/Table';
import { ConfirmDialog } from '@/components/ui/Modal';
import { useToast } from '@/providers/ToastProvider';
import { useState } from 'react';
import styles from './BlogList.module.css';

interface BlogPost {
  _id: Id<'blogPosts'>;
  title: string;
  slug: string;
  status: 'draft' | 'published';
  authorName: string;
  createdAt: number;
  publishedAt?: number;
  coverUrl: string | null;
}

interface BlogListProps {
  adminUserId: Id<'adminUsers'>;
}

export const BlogList = ({ adminUserId }: BlogListProps) => {
  const posts = useQuery(api.blogPosts.list, {});
  const removePost = useMutation(api.blogPosts.remove);
  const publishPost = useMutation(api.blogPosts.publish);
  const unpublishPost = useMutation(api.blogPosts.unpublish);
  const { success, error } = useToast();

  const [deleteTarget, setDeleteTarget] = useState<BlogPost | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published'>('all');

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await removePost({ id: deleteTarget._id, adminUserId });
      success('Artículo movido a la papelera');
      setDeleteTarget(null);
    } catch (err) {
      error(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleStatus = async (post: BlogPost) => {
    try {
      if (post.status === 'draft') {
        await publishPost({ id: post._id });
        success('Artículo publicado');
      } else {
        await unpublishPost({ id: post._id });
        success('Artículo despublicado');
      }
    } catch (err) {
      error(err instanceof Error ? err.message : 'Error al cambiar estado');
    }
  };

  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(timestamp));
  };

  const filteredPosts = posts?.filter((post) => {
    if (statusFilter === 'all') return true;
    return post.status === statusFilter;
  }) || [];

  const columns: Column<BlogPost>[] = [
    {
      key: 'title',
      header: 'Título',
      render: (post) => (
        <div>
          <span className={styles.title}>{post.title}</span>
          <span className={styles.slug}>/{post.slug}</span>
        </div>
      ),
    },
    {
      key: 'author',
      header: 'Autor',
      render: (post) => post.authorName,
    },
    {
      key: 'status',
      header: 'Estado',
      render: (post) => (
        <button
          className={`${styles.badge} ${post.status === 'published' ? styles.published : styles.draft}`}
          onClick={() => handleToggleStatus(post)}
          title={post.status === 'published' ? 'Clic para despublicar' : 'Clic para publicar'}
        >
          {post.status === 'published' ? 'Publicado' : 'Borrador'}
        </button>
      ),
    },
    {
      key: 'date',
      header: 'Fecha',
      render: (post) => (
        <span className={styles.date}>
          {post.publishedAt ? formatDate(post.publishedAt) : formatDate(post.createdAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '120px',
      render: (post) => (
        <div className={styles.actions}>
          <Link href={`/admin/blog/${post._id}/edit`}>
            <Button variant="ghost" size="sm">Editar</Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteTarget(post)}
          >
            Eliminar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Blog</h1>
          <p className={styles.subtitle}>Gestiona los artículos del blog</p>
        </div>
        <Link href="/admin/blog/new">
          <Button>Nuevo artículo</Button>
        </Link>
      </div>

      <div className={styles.filters}>
        <button
          className={`${styles.filterButton} ${statusFilter === 'all' ? styles.active : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          Todos ({posts?.length || 0})
        </button>
        <button
          className={`${styles.filterButton} ${statusFilter === 'published' ? styles.active : ''}`}
          onClick={() => setStatusFilter('published')}
        >
          Publicados ({posts?.filter((p) => p.status === 'published').length || 0})
        </button>
        <button
          className={`${styles.filterButton} ${statusFilter === 'draft' ? styles.active : ''}`}
          onClick={() => setStatusFilter('draft')}
        >
          Borradores ({posts?.filter((p) => p.status === 'draft').length || 0})
        </button>
      </div>

      <Table
        columns={columns}
        data={filteredPosts}
        keyExtractor={(post) => post._id}
        emptyMessage="No hay artículos"
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar artículo"
        message={`¿Estás seguro de que deseas eliminar "${deleteTarget?.title}"? Se moverá a la papelera.`}
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
};
