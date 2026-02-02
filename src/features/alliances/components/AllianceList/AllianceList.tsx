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
import styles from './AllianceList.module.css';

interface Alliance {
  _id: Id<'alliances'>;
  name: string;
  websiteUrl?: string;
  displayOrder: number;
  logoUrl: string | null;
}

interface AllianceListProps {
  adminUserId: Id<'adminUsers'>;
}

export const AllianceList = ({ adminUserId }: AllianceListProps) => {
  const alliances = useQuery(api.alliances.list);
  const removeAlliance = useMutation(api.alliances.remove);
  const { success, error } = useToast();

  const [deleteTarget, setDeleteTarget] = useState<Alliance | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await removeAlliance({ id: deleteTarget._id, adminUserId });
      success('Alianza movida a la papelera');
      setDeleteTarget(null);
    } catch (err) {
      error(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<Alliance>[] = [
    {
      key: 'logo',
      header: '',
      width: '80px',
      render: (alliance) => (
        <div className={styles.logo}>
          {alliance.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={alliance.logoUrl} alt={alliance.name} />
          ) : (
            <span className={styles.placeholder}>{alliance.name.charAt(0)}</span>
          )}
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Alianza',
      render: (alliance) => (
        <div>
          <span className={styles.name}>{alliance.name}</span>
          {alliance.websiteUrl && (
            <a
              href={alliance.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.website}
            >
              {alliance.websiteUrl.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '120px',
      render: (alliance) => (
        <div className={styles.actions}>
          <Link href={`/admin/alliances/${alliance._id}/edit`}>
            <Button variant="ghost" size="sm">Editar</Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteTarget(alliance)}
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
          <h1 className={styles.pageTitle}>Alianzas</h1>
          <p className={styles.subtitle}>Gestiona la sección "Nuestras Alianzas"</p>
        </div>
        <Link href="/admin/alliances/new">
          <Button>Agregar alianza</Button>
        </Link>
      </div>

      <Table
        columns={columns}
        data={alliances || []}
        keyExtractor={(alliance) => alliance._id}
        emptyMessage="No hay alianzas"
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar alianza"
        message={`¿Estás seguro de que deseas eliminar "${deleteTarget?.name}"? Se moverá a la papelera.`}
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
};
