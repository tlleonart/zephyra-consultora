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
import styles from './UserList.module.css';

interface AdminUser {
  _id: Id<'adminUsers'>;
  name: string;
  email: string;
  role: 'superadmin' | 'admin';
  isActive: boolean;
  createdAt: number;
  lastLoginAt?: number;
}

interface UserListProps {
  currentUserId: Id<'adminUsers'>;
}

export const UserList = ({ currentUserId }: UserListProps) => {
  const users = useQuery(api.adminUsers.list, { userId: currentUserId });
  const removeUser = useMutation(api.adminUsers.remove);
  const updateUser = useMutation(api.adminUsers.update);
  const { success, error } = useToast();

  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await removeUser({ userId: currentUserId, targetId: deleteTarget._id });
      success('Usuario eliminado correctamente');
      setDeleteTarget(null);
    } catch (err) {
      error(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (user: AdminUser) => {
    try {
      await updateUser({
        userId: currentUserId,
        targetId: user._id,
        isActive: !user.isActive,
      });
      success(user.isActive ? 'Usuario desactivado' : 'Usuario activado');
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

  const columns: Column<AdminUser>[] = [
    {
      key: 'name',
      header: 'Usuario',
      render: (user) => (
        <div>
          <span className={styles.name}>{user.name}</span>
          <span className={styles.email}>{user.email}</span>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Rol',
      render: (user) => (
        <span className={`${styles.roleBadge} ${user.role === 'superadmin' ? styles.superadmin : styles.admin}`}>
          {user.role === 'superadmin' ? 'Super Admin' : 'Admin'}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Estado',
      render: (user) => (
        <button
          className={`${styles.badge} ${user.isActive ? styles.active : styles.inactive}`}
          onClick={() => handleToggleActive(user)}
          disabled={user._id === currentUserId}
          title={user._id === currentUserId ? 'No puedes cambiar tu propio estado' : undefined}
        >
          {user.isActive ? 'Activo' : 'Inactivo'}
        </button>
      ),
    },
    {
      key: 'lastLogin',
      header: 'Último acceso',
      render: (user) => (
        <span className={styles.date}>
          {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Nunca'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '120px',
      render: (user) => (
        <div className={styles.actions}>
          <Link href={`/admin/users/${user._id}/edit`}>
            <Button variant="ghost" size="sm">Editar</Button>
          </Link>
          {user._id !== currentUserId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteTarget(user)}
            >
              Eliminar
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Administradores</h1>
          <p className={styles.subtitle}>Gestiona los usuarios administradores del sistema</p>
        </div>
        <Link href="/admin/users/new">
          <Button>Nuevo administrador</Button>
        </Link>
      </div>

      <Table
        columns={columns}
        data={users || []}
        keyExtractor={(user) => user._id}
        emptyMessage="No hay administradores"
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar administrador"
        message={`¿Estás seguro de que deseas eliminar a "${deleteTarget?.name}"? Esta acción moverá al usuario a la papelera.`}
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
};
