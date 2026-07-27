'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { requestPasswordReset } from '../../actions/password-reset';
import styles from './ForgotPasswordForm.module.css';

export const ForgotPasswordForm = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    await requestPasswordReset(email);
    setSubmitted(true);
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className={styles.success}>
        <h2 className={styles.title}>Revisa tu email</h2>
        <p className={styles.message}>
          Si existe una cuenta con el email <strong>{email}</strong>, recibirás un
          enlace para restablecer tu contraseña.
        </p>
        <Link href="/login" className={styles.backLink}>
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h2 className={styles.title}>Restablecer Contraseña</h2>
      <p className={styles.subtitle}>
        Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
      </p>

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

      <Button type="submit" loading={loading} className={styles.submitButton}>
        Enviar enlace
      </Button>

      <Link href="/login" className={styles.backLink}>
        Volver a iniciar sesión
      </Link>
    </form>
  );
};
