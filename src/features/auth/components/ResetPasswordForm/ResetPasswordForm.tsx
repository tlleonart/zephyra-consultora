'use client';

import { useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { resetPassword } from '../../actions/password-reset';
import styles from './ResetPasswordForm.module.css';

export const ResetPasswordForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className={styles.error}>
        <h2 className={styles.title}>Enlace inválido</h2>
        <p className={styles.message}>
          El enlace de restablecimiento no es válido. Por favor, solicita un
          nuevo enlace.
        </p>
        <Link href="/forgot-password" className={styles.link}>
          Solicitar nuevo enlace
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);

    const result = await resetPassword(token, password);

    if (result.success) {
      setSuccess(true);
    } else {
      setError(result.error || 'Error al restablecer contraseña');
    }

    setLoading(false);
  };

  if (success) {
    return (
      <div className={styles.success}>
        <h2 className={styles.title}>Contraseña actualizada</h2>
        <p className={styles.message}>
          Tu contraseña ha sido restablecida exitosamente.
        </p>
        <Link href="/login">
          <Button className={styles.loginButton}>Iniciar sesión</Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h2 className={styles.title}>Nueva Contraseña</h2>
      <p className={styles.subtitle}>
        Ingresa tu nueva contraseña para restablecer el acceso a tu cuenta.
      </p>

      {error && (
        <div className={styles.errorAlert} role="alert">
          {error}
        </div>
      )}

      <Input
        label="Nueva contraseña"
        type="password"
        name="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Mínimo 8 caracteres"
        required
        autoComplete="new-password"
      />

      <Input
        label="Confirmar contraseña"
        type="password"
        name="confirmPassword"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="Repite tu contraseña"
        required
        autoComplete="new-password"
      />

      <Button type="submit" loading={loading} className={styles.submitButton}>
        Restablecer contraseña
      </Button>

      <Link href="/login" className={styles.link}>
        Volver a iniciar sesión
      </Link>
    </form>
  );
};
