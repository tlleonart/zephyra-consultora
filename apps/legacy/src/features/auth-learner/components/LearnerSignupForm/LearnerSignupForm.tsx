'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@zephyra/ui';
import { Button } from '@zephyra/ui';
import { requestMagicLink } from '../../actions/request-magic-link';
import styles from './LearnerSignupForm.module.css';

type Purpose = 'learner_activation' | 'learner_recovery';

interface Props {
  purpose?: Purpose;
  title?: string;
  subtitle?: string;
  buttonLabel?: string;
}

export const LearnerSignupForm = ({
  purpose = 'learner_activation',
  title = 'Empezá tus cursos en Zephyra',
  subtitle = 'Ingresá tu email y te enviamos un link de activación.',
  buttonLabel = 'Recibir link de activación',
}: Props) => {
  const router = useRouter();
  const [email, setEmail] = useState('');
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
      const result = await requestMagicLink(email, purpose);
      if (result.success && result.alreadyActivated) {
        setSuccessMessage(
          'Esta cuenta ya está activada. Redirigiendo al login...'
        );
        setTimeout(() => router.push('/cursos/auth/signin'), 1500);
      } else if (result.success) {
        setSuccessMessage(
          `Te enviamos un link a ${email}. Revisalo y hacé clic para continuar.`
        );
      } else {
        // Anti-enumeration uniform message; the server action already collapses
        // most failure modes into success=true so this branch is largely dead.
        setError(
          'Si esta cuenta no está registrada, recibirás un link.'
        );
      }
    } catch {
      setError('Si esta cuenta no está registrada, recibirás un link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form} noValidate>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.subtitle}>{subtitle}</p>

      {error && (
        <div
          id="signup-error"
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
          id="signup-success"
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
            aria-describedby={error ? 'signup-error' : undefined}
          />

          <Button
            type="submit"
            loading={loading}
            className={styles.submitButton}
          >
            {buttonLabel}
          </Button>
        </>
      )}

      <Link href="/cursos/auth/signin" className={styles.footerLink}>
        ¿Ya tenés cuenta? Iniciá sesión
      </Link>
    </form>
  );
};
