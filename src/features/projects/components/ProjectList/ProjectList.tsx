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
import styles from './ProjectList.module.css';

interface ProjectAchievement {
  _id: Id<'projectAchievements'>;
  description: string;
  displayOrder: number;
}

interface Project {
  _id: Id<'projects'>;
  title: string;
  slug: string;
  excerpt: string;
  description: string;
  isFeatured: boolean;
  displayOrder: number;
  createdAt: number;
  imageUrl: string | null;
  achievements: ProjectAchievement[];
}

interface ProjectListProps {
  adminUserId: Id<'adminUsers'>;
}

export const ProjectList = ({ adminUserId }: ProjectListProps) => {
  const projects = useQuery(api.projects.list);
  const removeProject = useMutation(api.projects.remove);
  const toggleFeatured = useMutation(api.projects.toggleFeatured);
  const { success, error } = useToast();

  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filterFeatured, setFilterFeatured] = useState<'all' | 'featured' | 'regular'>('all');

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await removeProject({ id: deleteTarget._id, adminUserId });
      success('Proyecto movido a la papelera');
      setDeleteTarget(null);
    } catch (err) {
      error(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleFeatured = async (project: Project) => {
    try {
      await toggleFeatured({ id: project._id });
      success(project.isFeatured ? 'Proyecto desmarcado como destacado' : 'Proyecto marcado como destacado');
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

  const filteredProjects = projects?.filter((project) => {
    if (filterFeatured === 'all') return true;
    if (filterFeatured === 'featured') return project.isFeatured;
    return !project.isFeatured;
  }) || [];

  const columns: Column<Project>[] = [
    {
      key: 'image',
      header: '',
      width: '80px',
      render: (project) => (
        <div className={styles.thumbnail}>
          {project.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={project.imageUrl} alt={project.title} />
          ) : (
            <span className={styles.placeholder}>Sin imagen</span>
          )}
        </div>
      ),
    },
    {
      key: 'title',
      header: 'Proyecto',
      render: (project) => (
        <div>
          <span className={styles.title}>{project.title}</span>
          <span className={styles.slug}>/{project.slug}</span>
        </div>
      ),
    },
    {
      key: 'achievements',
      header: 'Logros',
      render: (project) => (
        <span className={styles.achievementCount}>
          {project.achievements.length} {project.achievements.length === 1 ? 'logro' : 'logros'}
        </span>
      ),
    },
    {
      key: 'featured',
      header: 'Destacado',
      render: (project) => (
        <button
          className={`${styles.badge} ${project.isFeatured ? styles.featured : styles.regular}`}
          onClick={() => handleToggleFeatured(project)}
          title={project.isFeatured ? 'Clic para desmarcar como destacado' : 'Clic para destacar'}
        >
          {project.isFeatured ? 'Destacado' : 'Regular'}
        </button>
      ),
    },
    {
      key: 'date',
      header: 'Creado',
      render: (project) => (
        <span className={styles.date}>{formatDate(project.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '120px',
      render: (project) => (
        <div className={styles.actions}>
          <Link href={`/admin/projects/${project._id}/edit`}>
            <Button variant="ghost" size="sm">Editar</Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteTarget(project)}
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
          <h1 className={styles.pageTitle}>Proyectos</h1>
          <p className={styles.subtitle}>Gestiona los proyectos y sus logros</p>
        </div>
        <Link href="/admin/projects/new">
          <Button>Nuevo proyecto</Button>
        </Link>
      </div>

      <div className={styles.filters}>
        <button
          className={`${styles.filterButton} ${filterFeatured === 'all' ? styles.active : ''}`}
          onClick={() => setFilterFeatured('all')}
        >
          Todos ({projects?.length || 0})
        </button>
        <button
          className={`${styles.filterButton} ${filterFeatured === 'featured' ? styles.active : ''}`}
          onClick={() => setFilterFeatured('featured')}
        >
          Destacados ({projects?.filter((p) => p.isFeatured).length || 0})
        </button>
        <button
          className={`${styles.filterButton} ${filterFeatured === 'regular' ? styles.active : ''}`}
          onClick={() => setFilterFeatured('regular')}
        >
          Regulares ({projects?.filter((p) => !p.isFeatured).length || 0})
        </button>
      </div>

      <Table
        columns={columns}
        data={filteredProjects}
        keyExtractor={(project) => project._id}
        emptyMessage="No hay proyectos"
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar proyecto"
        message={`¿Estás seguro de que deseas eliminar "${deleteTarget?.title}"? Se moverá a la papelera junto con sus logros.`}
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
};
