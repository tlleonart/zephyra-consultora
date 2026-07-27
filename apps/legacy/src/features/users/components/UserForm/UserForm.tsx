'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import { Id } from '../../../../../convex/_generated/dataModel';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card';
import { useToast } from '@/providers/ToastProvider';
import styles from './UserForm.module.css';

interface UserFormProps {
  mode: 'create' | 'edit';
  currentUserId: Id<'adminUsers'>;
  initialData?: {
    _id: Id<'adminUsers'>;
    name: string;
    email: string;
    role: 'superadmin' | 'admin';
    isActive: boolean;
  };
}

export const UserForm = ({ mode, currentUserId, initialData }: UserFormProps) => {
  const router = useRouter();
  const { success, error } = useToast();

  const createUser = useMutation(api.adminUsers.create);
  const updateUser = useMutation(api.adminUsers.update);

  const [name, setName] = useState(initialData?.name || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'superadmin' | 'admin'>(initialData?.role || 'admin');
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isSelf = initialData?._id === currentUserId;

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'El nombre es requerido';
    if (!email.trim()) newErrors.email = 'El email es requerido';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Ingresa un email válido';
    }
    if (mode === 'create' && !password) {
      newErrors.password = 'La contraseña es requerida';
    }
    if (password && password.length < 8) {
      newErrors.password = 'La contraseña debe tener al menos 8 caracteres';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      if (mode === 'create') {
        await createUser({
          userId: currentUserId,
          email,
          name,
          password,
          role,
        });
        success('Administrador creado correctamente');
      } else if (initialData) {
        await updateUser({
          userId: currentUserId,
          targetId: initialData._id,
          email,
          name,
          password: password || undefined,
          role: isSelf ? undefined : role,
          isActive: isSelf ? undefined : isActive,
        });
        success('Administrador actualizado correctamente');
      }
      router.push('/admin/users');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = [
    { value: 'admin', label: 'Administrador' },
    { value: 'superadmin', label: 'Super Administrador' },
  ];

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <Card>
        <CardHeader
          title={mode === 'create' ? 'Nuevo administrador' : 'Editar administrador'}
          description={
            isSelf
              ? 'Estás editando tu propio perfil'
              : 'Completa la información del administrador'
          }
        />
        <CardContent>
          <div className={styles.fields}>
            <Input
              label="Nombre completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              required
            />

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              required
            />

            <Input
              label={mode === 'create' ? 'Contraseña' : 'Nueva contraseña'}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint={mode === 'edit' ? 'Deja en blanco para mantener la actual' : 'Mínimo 8 caracteres'}
              error={errors.password}
              required={mode === 'create'}
            />

            <Select
              label="Rol"
              value={role}
              onChange={(e) => setRole(e.target.value as 'superadmin' | 'admin')}
              options={roleOptions}
              disabled={isSelf}
            />

            {mode === 'edit' && !isSelf && (
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span>Usuario activo</span>
              </label>
            )}

            {isSelf && mode === 'edit' && (
              <p className={styles.warning}>
                <span className="material-icons">info</span>
                No puedes cambiar tu propio rol ni estado de activación.
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push('/admin/users')}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            {mode === 'create' ? 'Crear administrador' : 'Guardar cambios'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
};
