'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import { Id } from '../../../../../convex/_generated/dataModel';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, Column } from '@/components/ui/Table';
import { Card, CardContent } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Modal';
import { ExportButton } from '../ExportButton';
import { useToast } from '@/providers/ToastProvider';
import { useState } from 'react';
import styles from './SubscriberList.module.css';

interface Subscriber {
  _id: Id<'newsletterSubscribers'>;
  email: string;
  subscribedAt: number;
  isActive: boolean;
  unsubscribedAt?: number;
}

export const SubscriberList = () => {
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'unsubscribed'>('all');

  const stats = useQuery(api.newsletter.getStats);
  const subscribers = useQuery(api.newsletter.list, {
    search: search || undefined,
    filterActive: filterActive === 'all' ? undefined : filterActive === 'active',
  });

  const setActive = useMutation(api.newsletter.setActive);
  const removeSubscriber = useMutation(api.newsletter.remove);
  const { success, error } = useToast();

  const [deleteTarget, setDeleteTarget] = useState<Subscriber | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleToggleActive = async (subscriber: Subscriber) => {
    try {
      await setActive({ id: subscriber._id, isActive: !subscriber.isActive });
      success(subscriber.isActive ? 'Suscriptor dado de baja' : 'Suscriptor reactivado');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Error al cambiar estado');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await removeSubscriber({ id: deleteTarget._id });
      success('Suscriptor eliminado permanentemente');
      setDeleteTarget(null);
    } catch (err) {
      error(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(timestamp));
  };

  const columns: Column<Subscriber>[] = [
    {
      key: 'email',
      header: 'Email',
      render: (subscriber) => (
        <span className={styles.email}>{subscriber.email}</span>
      ),
    },
    {
      key: 'subscribedAt',
      header: 'Fecha de suscripción',
      render: (subscriber) => (
        <span className={styles.date}>{formatDate(subscriber.subscribedAt)}</span>
      ),
    },
    {
      key: 'isActive',
      header: 'Estado',
      render: (subscriber) => (
        <button
          className={`${styles.badge} ${subscriber.isActive ? styles.active : styles.unsubscribed}`}
          onClick={() => handleToggleActive(subscriber)}
          title={subscriber.isActive ? 'Clic para dar de baja' : 'Clic para reactivar'}
        >
          {subscriber.isActive ? 'Activo' : 'Dado de baja'}
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '80px',
      render: (subscriber) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDeleteTarget(subscriber)}
        >
          Eliminar
        </Button>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Newsletter</h1>
          <p className={styles.subtitle}>Gestiona los suscriptores del newsletter</p>
        </div>
        <ExportButton />
      </div>

      <div className={styles.statsGrid}>
        <Card>
          <CardContent className={styles.statCard}>
            <span className={styles.statValue}>{stats?.total || 0}</span>
            <span className={styles.statLabel}>Total suscriptores</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className={styles.statCard}>
            <span className={`${styles.statValue} ${styles.activeValue}`}>{stats?.active || 0}</span>
            <span className={styles.statLabel}>Activos</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className={styles.statCard}>
            <span className={styles.statValue}>{stats?.unsubscribed || 0}</span>
            <span className={styles.statLabel}>Dados de baja</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className={styles.statCard}>
            <span className={styles.statValue}>{stats?.recent || 0}</span>
            <span className={styles.statLabel}>Últimos 30 días</span>
          </CardContent>
        </Card>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por email..."
          />
        </div>

        <div className={styles.filters}>
          <button
            className={`${styles.filterButton} ${filterActive === 'all' ? styles.filterActive : ''}`}
            onClick={() => setFilterActive('all')}
          >
            Todos
          </button>
          <button
            className={`${styles.filterButton} ${filterActive === 'active' ? styles.filterActive : ''}`}
            onClick={() => setFilterActive('active')}
          >
            Activos
          </button>
          <button
            className={`${styles.filterButton} ${filterActive === 'unsubscribed' ? styles.filterActive : ''}`}
            onClick={() => setFilterActive('unsubscribed')}
          >
            Dados de baja
          </button>
        </div>
      </div>

      <Table
        columns={columns}
        data={subscribers || []}
        keyExtractor={(subscriber) => subscriber._id}
        emptyMessage={search ? 'No se encontraron suscriptores' : 'No hay suscriptores'}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar suscriptor"
        message={`¿Estás seguro de que deseas eliminar "${deleteTarget?.email}"? Esta acción es permanente y no se puede deshacer.`}
        confirmLabel="Eliminar permanentemente"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
};
