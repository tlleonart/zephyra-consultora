'use client';

import Link from 'next/link';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@zephyra/convex/_generated/api';
import { Id } from '@zephyra/convex/_generated/dataModel';
import { Button, btnClass } from '@zephyra/ui';
import { Table, Column } from '@zephyra/ui';
import { ConfirmDialog } from '@zephyra/ui';
import { useToast } from '@zephyra/ui/providers/ToastProvider';
import { useState } from 'react';
import styles from './ClientList.module.css';

interface Client {
  _id: Id<'clients'>;
  name: string;
  websiteUrl?: string;
  displayOrder: number;
  logoUrl: string | null;
}

interface ClientListProps {
  adminUserId: Id<'adminUsers'>;
}

export const ClientList = ({ adminUserId }: ClientListProps) => {
  const clients = useQuery(api.clients.list);
  const removeClient = useMutation(api.clients.remove);
  const { success, error } = useToast();

  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await removeClient({ id: deleteTarget._id, adminUserId });
      success('Cliente movido a la papelera');
      setDeleteTarget(null);
    } catch (err) {
      error(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<Client>[] = [
    {
      key: 'logo',
      header: '',
      width: '80px',
      render: (client) => (
        <div className={styles.logo}>
          {client.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={client.logoUrl} alt={client.name} />
          ) : (
            <span className={styles.placeholder}>{client.name.charAt(0)}</span>
          )}
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Cliente',
      render: (client) => (
        <div>
          <span className={styles.name}>{client.name}</span>
          {client.websiteUrl && (
            <a
              href={client.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.website}
            >
              {client.websiteUrl.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '120px',
      render: (client) => (
        <div className={styles.actions}>
          <Link
            href={`/admin/clients/${client._id}/edit`}
            className={btnClass({ variant: 'outline', size: 'sm' })}
          >
            Editar
          </Link>
          <Button
            variant="dangerSoft"
            size="sm"
            onClick={() => setDeleteTarget(client)}
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
          <h1 className={styles.pageTitle}>Clientes</h1>
          <p className={styles.subtitle}>Gestiona la sección &quot;Ya confían en nosotros&quot;</p>
        </div>
        <Link href="/admin/clients/new" className={btnClass()}>
          Agregar cliente
        </Link>
      </div>

      <Table
        columns={columns}
        data={clients || []}
        keyExtractor={(client) => client._id}
        emptyMessage="No hay clientes"
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar cliente"
        message={`¿Estás seguro de que deseas eliminar "${deleteTarget?.name}"? Se moverá a la papelera.`}
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
};
