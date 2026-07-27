'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Modal';
import { useToast } from '@/providers/ToastProvider';
import { useState } from 'react';
import styles from './TrashList.module.css';

type EntityType = 'blogPosts' | 'teamMembers' | 'projects' | 'services' | 'clients' | 'alliances' | 'adminUsers';

interface TrashItem {
  _id: string;
  entityType: EntityType;
  name: string;
  deletedAt: number;
  deletedBy?: string;
  deletedByName?: string;
}

const ENTITY_LABELS: Record<EntityType, string> = {
  blogPosts: 'Artículos del blog',
  teamMembers: 'Miembros del equipo',
  projects: 'Proyectos',
  services: 'Servicios',
  clients: 'Clientes',
  alliances: 'Alianzas',
  adminUsers: 'Administradores',
};

const ENTITY_ICONS: Record<EntityType, string> = {
  blogPosts: 'article',
  teamMembers: 'person',
  projects: 'work',
  services: 'build',
  clients: 'business',
  alliances: 'handshake',
  adminUsers: 'admin_panel_settings',
};

export const TrashList = () => {
  const trashItems = useQuery(api.trash.list);
  const restoreItem = useMutation(api.trash.restore);
  const deleteItem = useMutation(api.trash.permanentDelete);
  const { success, error } = useToast();

  const [deleteTarget, setDeleteTarget] = useState<TrashItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  const handleRestore = async (item: TrashItem) => {
    setRestoring(item._id);
    try {
      await restoreItem({ entityType: item.entityType, entityId: item._id });
      success(`"${item.name}" restaurado correctamente`);
    } catch (err) {
      error(err instanceof Error ? err.message : 'Error al restaurar');
    } finally {
      setRestoring(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await deleteItem({ entityType: deleteTarget.entityType, entityId: deleteTarget._id });
      success(`"${deleteTarget.name}" eliminado permanentemente`);
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
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  };

  const getDaysRemaining = (deletedAt: number) => {
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const remaining = deletedAt + thirtyDays - Date.now();
    const days = Math.ceil(remaining / (24 * 60 * 60 * 1000));
    return Math.max(0, days);
  };

  // Group items by entity type
  const groupedItems = (trashItems || []).reduce((acc, item) => {
    if (!acc[item.entityType]) {
      acc[item.entityType] = [];
    }
    acc[item.entityType].push(item);
    return acc;
  }, {} as Record<EntityType, TrashItem[]>);

  const entityTypes = Object.keys(groupedItems) as EntityType[];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Papelera</h1>
          <p className={styles.subtitle}>
            Los elementos eliminados se conservan por 30 días antes de ser eliminados permanentemente
          </p>
        </div>
      </div>

      {(trashItems?.length || 0) === 0 ? (
        <Card>
          <CardContent className={styles.emptyState}>
            <span className={`material-icons ${styles.emptyIcon}`}>delete_outline</span>
            <p>La papelera está vacía</p>
          </CardContent>
        </Card>
      ) : (
        <div className={styles.groups}>
          {entityTypes.map((entityType) => (
            <Card key={entityType}>
              <CardHeader
                title={ENTITY_LABELS[entityType]}
                description={`${groupedItems[entityType].length} elemento(s)`}
              />
              <CardContent className={styles.itemList}>
                {groupedItems[entityType].map((item) => {
                  const daysRemaining = getDaysRemaining(item.deletedAt);
                  return (
                    <div key={item._id} className={styles.item}>
                      <div className={styles.itemIcon}>
                        <span className="material-icons">{ENTITY_ICONS[item.entityType]}</span>
                      </div>
                      <div className={styles.itemInfo}>
                        <span className={styles.itemName}>{item.name}</span>
                        <span className={styles.itemMeta}>
                          Eliminado {formatDate(item.deletedAt)}
                          {item.deletedByName && ` por ${item.deletedByName}`}
                        </span>
                        <span className={`${styles.countdown} ${daysRemaining <= 7 ? styles.urgent : ''}`}>
                          {daysRemaining === 0
                            ? 'Se eliminará hoy'
                            : `Se eliminará en ${daysRemaining} día${daysRemaining === 1 ? '' : 's'}`}
                        </span>
                      </div>
                      <div className={styles.itemActions}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleRestore(item)}
                          loading={restoring === item._id}
                          disabled={restoring !== null}
                        >
                          Restaurar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(item)}
                          disabled={restoring !== null}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handlePermanentDelete}
        title="Eliminar permanentemente"
        message={`¿Estás seguro de que deseas eliminar "${deleteTarget?.name}" permanentemente? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar permanentemente"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
};
