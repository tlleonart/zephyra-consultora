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
import styles from './TeamList.module.css';

interface TeamMember {
  _id: Id<'teamMembers'>;
  name: string;
  role: string;
  specialty: string;
  isVisible: boolean;
  displayOrder: number;
  imageUrl: string | null;
}

interface TeamListProps {
  adminUserId: Id<'adminUsers'>;
}

export const TeamList = ({ adminUserId }: TeamListProps) => {
  const members = useQuery(api.teamMembers.list);
  const removeMember = useMutation(api.teamMembers.remove);
  const reorderMembers = useMutation(api.teamMembers.reorder);
  const { success, error } = useToast();

  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleMoveUp = async (index: number) => {
    if (!members || index <= 0) return;
    const reordered = [...members];
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    try {
      await reorderMembers({ orderedIds: reordered.map((m) => m._id) });
    } catch (err) {
      error(err instanceof Error ? err.message : 'Error al reordenar');
    }
  };

  const handleMoveDown = async (index: number) => {
    if (!members || index >= members.length - 1) return;
    const reordered = [...members];
    [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
    try {
      await reorderMembers({ orderedIds: reordered.map((m) => m._id) });
    } catch (err) {
      error(err instanceof Error ? err.message : 'Error al reordenar');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await removeMember({ id: deleteTarget._id, adminUserId });
      success('Miembro eliminado correctamente');
      setDeleteTarget(null);
    } catch (err) {
      error(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<TeamMember>[] = [
    {
      key: 'image',
      header: '',
      width: '60px',
      render: (member) => (
        <div className={styles.avatar}>
          {member.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={member.imageUrl} alt={member.name} />
          ) : (
            <span>{member.name.charAt(0)}</span>
          )}
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Nombre',
      render: (member) => (
        <div>
          <span className={styles.name}>{member.name}</span>
          <span className={styles.role}>{member.role}</span>
        </div>
      ),
    },
    {
      key: 'specialty',
      header: 'Especialidad',
    },
    {
      key: 'isVisible',
      header: 'Estado',
      render: (member) => (
        <span className={`${styles.badge} ${member.isVisible ? styles.visible : styles.hidden}`}>
          {member.isVisible ? 'Visible' : 'Oculto'}
        </span>
      ),
    },
    {
      key: 'order',
      header: 'Orden',
      width: '80px',
      render: (member) => {
        const index = members?.findIndex((m) => m._id === member._id) ?? -1;
        return (
          <div className={styles.orderButtons}>
            <button
              className={styles.reorderButton}
              onClick={() => handleMoveUp(index)}
              disabled={index <= 0}
              title="Mover arriba"
            >
              ▲
            </button>
            <button
              className={styles.reorderButton}
              onClick={() => handleMoveDown(index)}
              disabled={!members || index >= members.length - 1}
              title="Mover abajo"
            >
              ▼
            </button>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      width: '120px',
      render: (member) => (
        <div className={styles.actions}>
          <Link href={`/admin/team/${member._id}/edit`}>
            <Button variant="ghost" size="sm">Editar</Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteTarget(member)}
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
          <h1 className={styles.title}>Equipo</h1>
          <p className={styles.subtitle}>Gestiona los miembros del equipo</p>
        </div>
        <Link href="/admin/team/new">
          <Button>Agregar miembro</Button>
        </Link>
      </div>

      <Table
        columns={columns}
        data={members || []}
        keyExtractor={(member) => member._id}
        emptyMessage="No hay miembros del equipo"
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar miembro"
        message={`¿Estás seguro de que deseas eliminar a "${deleteTarget?.name}"? Esta acción lo moverá a la papelera.`}
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
};
