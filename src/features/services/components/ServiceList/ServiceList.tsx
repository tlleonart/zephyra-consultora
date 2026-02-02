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
import styles from './ServiceList.module.css';

interface Service {
  _id: Id<'services'>;
  title: string;
  description: string;
  iconName: string;
  isActive: boolean;
  displayOrder: number;
}

interface ServiceListProps {
  adminUserId: Id<'adminUsers'>;
}

export const ServiceList = ({ adminUserId }: ServiceListProps) => {
  const services = useQuery(api.services.list);
  const removeService = useMutation(api.services.remove);
  const toggleActive = useMutation(api.services.toggleActive);
  const { success, error } = useToast();

  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await removeService({ id: deleteTarget._id, adminUserId });
      success('Servicio movido a la papelera');
      setDeleteTarget(null);
    } catch (err) {
      error(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (service: Service) => {
    try {
      await toggleActive({ id: service._id });
      success(service.isActive ? 'Servicio desactivado' : 'Servicio activado');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Error al cambiar estado');
    }
  };

  const filteredServices = services?.filter((service) => {
    if (filterActive === 'all') return true;
    if (filterActive === 'active') return service.isActive;
    return !service.isActive;
  }) || [];

  const columns: Column<Service>[] = [
    {
      key: 'icon',
      header: '',
      width: '60px',
      render: (service) => (
        <div className={styles.iconPreview}>
          <span className="material-icons">{service.iconName}</span>
        </div>
      ),
    },
    {
      key: 'title',
      header: 'Servicio',
      render: (service) => (
        <div>
          <span className={styles.title}>{service.title}</span>
          <span className={styles.description}>
            {service.description.substring(0, 60)}
            {service.description.length > 60 ? '...' : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'isActive',
      header: 'Estado',
      render: (service) => (
        <button
          className={`${styles.badge} ${service.isActive ? styles.active : styles.inactive}`}
          onClick={() => handleToggleActive(service)}
          title={service.isActive ? 'Clic para desactivar' : 'Clic para activar'}
        >
          {service.isActive ? 'Activo' : 'Inactivo'}
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '120px',
      render: (service) => (
        <div className={styles.actions}>
          <Link href={`/admin/services/${service._id}/edit`}>
            <Button variant="ghost" size="sm">Editar</Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteTarget(service)}
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
          <h1 className={styles.pageTitle}>Servicios</h1>
          <p className={styles.subtitle}>Gestiona los servicios que ofrece la consultora</p>
        </div>
        <Link href="/admin/services/new">
          <Button>Nuevo servicio</Button>
        </Link>
      </div>

      <div className={styles.filters}>
        <button
          className={`${styles.filterButton} ${filterActive === 'all' ? styles.filterActive : ''}`}
          onClick={() => setFilterActive('all')}
        >
          Todos ({services?.length || 0})
        </button>
        <button
          className={`${styles.filterButton} ${filterActive === 'active' ? styles.filterActive : ''}`}
          onClick={() => setFilterActive('active')}
        >
          Activos ({services?.filter((s) => s.isActive).length || 0})
        </button>
        <button
          className={`${styles.filterButton} ${filterActive === 'inactive' ? styles.filterActive : ''}`}
          onClick={() => setFilterActive('inactive')}
        >
          Inactivos ({services?.filter((s) => !s.isActive).length || 0})
        </button>
      </div>

      <Table
        columns={columns}
        data={filteredServices}
        keyExtractor={(service) => service._id}
        emptyMessage="No hay servicios"
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar servicio"
        message={`¿Estás seguro de que deseas eliminar "${deleteTarget?.title}"? Se moverá a la papelera.`}
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
};
