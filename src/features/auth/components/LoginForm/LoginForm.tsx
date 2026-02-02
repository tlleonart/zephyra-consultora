'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { login } from '../../actions/login';
import styles from './LoginForm.module.css';

export const LoginForm = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        router.push('/admin');
        router.refresh();
      } else {
        setError(result.error || 'Error al iniciar sesión');
      }
    } catch {
      setError('Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h2 className={styles.title}>Iniciar Sesión</h2>
      <p className={styles.subtitle}>Ingresa tus credenciales para acceder al dashboard</p>

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      <Input
        label="Email"
        type="email"
        name="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="admin@zephyraconsultora.com"
        required
        autoComplete="email"
      />

      <Input
        label="Contraseña"
        type="password"
        name="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Tu contraseña"
        required
        autoComplete="current-password"
      />

      <Button type="submit" loading={loading} className={styles.submitButton}>
        Iniciar Sesión
      </Button>

      <Link href="/forgot-password" className={styles.forgotLink}>
        ¿Olvidaste tu contraseña?
      </Link>
    </form>
  );
};
