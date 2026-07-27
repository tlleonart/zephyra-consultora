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
import styles from './ServiceBlockList.module.css';

interface ServiceBlock {
  _id: Id<'serviceBlocks'>;
  title: string;
  subtitle: string;
  isActive: boolean;
  displayOrder: number;
  serviceCount: number;
  imageUrl: string | null;
}

interface ServiceBlockListProps {
  adminUserId: Id<'adminUsers'>;
}

export const ServiceBlockList = ({ adminUserId }: ServiceBlockListProps) => {
  const blocks = useQuery(api.serviceBlocks.list);
  const removeBlock = useMutation(api.serviceBlocks.remove);
  const toggleActive = useMutation(api.serviceBlocks.toggleActive);
  const { success, error } = useToast();

  const [deleteTarget, setDeleteTarget] = useState<ServiceBlock | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await removeBlock({ id: deleteTarget._id, adminUserId });
      success('Bloque movido a la papelera');
      setDeleteTarget(null);
    } catch (err) {
      error(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (block: ServiceBlock) => {
    try {
      await toggleActive({ id: block._id });
      success(block.isActive ? 'Bloque desactivado' : 'Bloque activado');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Error al cambiar estado');
    }
  };

  const filteredBlocks = blocks?.filter((block) => {
    if (filterActive === 'all') return true;
    if (filterActive === 'active') return block.isActive;
    return !block.isActive;
  }) || [];

  const columns: Column<ServiceBlock>[] = [
    {
      key: 'title',
      header: 'Bloque',
      render: (block) => (
        <div>
          <span className={styles.title}>{block.title}</span>
          <span className={styles.subtitle}>
            {block.subtitle.substring(0, 80)}
            {block.subtitle.length > 80 ? '...' : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'serviceCount',
      header: 'Servicios',
      width: '100px',
      render: (block) => (
        <span className={styles.count}>{block.serviceCount}</span>
      ),
    },
    {
      key: 'isActive',
      header: 'Estado',
      render: (block) => (
        <button
          className={`${styles.badge} ${block.isActive ? styles.active : styles.inactive}`}
          onClick={() => handleToggleActive(block)}
          title={block.isActive ? 'Clic para desactivar' : 'Clic para activar'}
        >
          {block.isActive ? 'Activo' : 'Inactivo'}
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '120px',
      render: (block) => (
        <div className={styles.actions}>
          <Link href={`/admin/service-blocks/${block._id}/edit`}>
            <Button variant="ghost" size="sm">Editar</Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteTarget(block)}
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
          <h1 className={styles.pageTitle}>Bloques de servicios</h1>
          <p className={styles.headerSubtitle}>Gestiona los bloques que agrupan los servicios</p>
        </div>
        <Link href="/admin/service-blocks/new">
          <Button>Nuevo bloque</Button>
        </Link>
      </div>

      <div className={styles.filters}>
        <button
          className={`${styles.filterButton} ${filterActive === 'all' ? styles.filterActive : ''}`}
          onClick={() => setFilterActive('all')}
        >
          Todos ({blocks?.length || 0})
        </button>
        <button
          className={`${styles.filterButton} ${filterActive === 'active' ? styles.filterActive : ''}`}
          onClick={() => setFilterActive('active')}
        >
          Activos ({blocks?.filter((b) => b.isActive).length || 0})
        </button>
        <button
          className={`${styles.filterButton} ${filterActive === 'inactive' ? styles.filterActive : ''}`}
          onClick={() => setFilterActive('inactive')}
        >
          Inactivos ({blocks?.filter((b) => !b.isActive).length || 0})
        </button>
      </div>

      <Table
        columns={columns}
        data={filteredBlocks}
        keyExtractor={(block) => block._id}
        emptyMessage="No hay bloques de servicios"
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar bloque"
        message={`¿Estás seguro de que deseas eliminar "${deleteTarget?.title}"? Los servicios asignados quedarán sin bloque.`}
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
};
