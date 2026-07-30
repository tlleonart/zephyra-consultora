'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@zephyra/ui';
import { Button } from '@zephyra/ui';
import { requestMagicLink } from '../../actions/request-magic-link';
import { signInLearnerWithPassword } from '../../actions/signin-password';
import styles from './LearnerSigninForm.module.css';

export const LearnerSigninForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? undefined;

  const [mode, setMode] = useState<'magic' | 'password'>('magic');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const successRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (successMessage && successRef.current) {
      successRef.current.focus();
    }
  }, [successMessage]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'password') {
        const result = await signInLearnerWithPassword(email, password);
        if (result.success) {
          router.push(returnTo ?? '/cursos');
          router.refresh();
        } else {
          setError(result.error ?? 'credenciales inválidas');
        }
      } else {
        const result = await requestMagicLink(
          email,
          'learner_signin',
          returnTo
        );
        if (result.success) {
          setSuccessMessage(
            'Te enviamos un link. Revisá tu mail.'
          );
        } else {
          // Anti-enumeration uniform message.
          setSuccessMessage(
            'Si esta cuenta existe, recibirás un link.'
          );
        }
      }
    } catch {
      if (mode === 'password') {
        setError('credenciales inválidas');
      } else {
        setSuccessMessage('Si esta cuenta existe, recibirás un link.');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === 'magic' ? 'password' : 'magic'));
    setError('');
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form} noValidate>
      <h2 className={styles.title}>Iniciá sesión</h2>
      <p className={styles.subtitle}>
        {mode === 'magic'
          ? 'Te enviamos un link al mail. Sin contraseñas.'
          : 'Ingresá con tu email y contraseña.'}
      </p>

      {error && (
        <div
          id="signin-error"
          className={styles.error}
          role="alert"
          aria-live="assertive"
        >
          {error}
        </div>
      )}

      {successMessage && (
        <div
          ref={successRef}
          id="signin-success"
          className={styles.success}
          role="status"
          aria-live="polite"
          tabIndex={-1}
        >
          {successMessage}
        </div>
      )}

      {!successMessage && (
        <>
          <Input
            label="Email"
            type="email"
            name="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            required
            autoComplete="email"
            aria-describedby={error ? 'signin-error' : undefined}
          />

          {mode === 'password' && (
            <Input
              label="Contraseña"
              type="password"
              name="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu contraseña"
              required
              autoComplete="current-password"
              aria-describedby={error ? 'signin-error' : undefined}
            />
          )}

          <div className={styles.toggleRow}>
            <button
              type="button"
              className={styles.toggleButton}
              onClick={toggleMode}
            >
              {mode === 'magic'
                ? 'Tengo contraseña'
                : 'Recibir link en vez de contraseña'}
            </button>
          </div>

          <Button
            type="submit"
            loading={loading}
            className={styles.submitButton}
          >
            {mode === 'magic' ? 'Recibir link de ingreso' : 'Iniciar sesión'}
          </Button>
        </>
      )}

      <div className={styles.footerLinks}>
        <Link href="/cursos/auth/signup" className={styles.footerLink}>
          ¿No tenés cuenta? Empezá
        </Link>
        <Link href="/cursos/auth/recovery" className={styles.footerLink}>
          ¿Perdiste el acceso? Recuperalo
        </Link>
      </div>
    </form>
  );
};
