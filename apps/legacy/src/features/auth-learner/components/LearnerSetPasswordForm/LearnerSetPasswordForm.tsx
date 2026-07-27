'use client';

import { useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { setLearnerPassword } from '../../actions/set-password';
import styles from './LearnerSetPasswordForm.module.css';

const MIN_LENGTH = 8;
const NON_ALPHA_RE = /[^A-Za-z0-9]/;

export const LearnerSetPasswordForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firstTime = searchParams.get('firstTime') === 'true';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateLocal = (): string | null => {
    if (password.length < MIN_LENGTH) {
      return `La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`;
    }
    if (!NON_ALPHA_RE.test(password)) {
      return 'La contraseña debe incluir al menos un carácter no alfanumérico.';
    }
    if (password !== confirm) {
      return 'Las contraseñas no coinciden.';
    }
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const localError = validateLocal();
    if (localError) {
      setError(localError);
      return;
    }

    setLoading(true);
    try {
      const result = await setLearnerPassword(password);
      if (result.success) {
        router.push('/cursos');
        router.refresh();
      } else {
        setError(result.error ?? 'No se pudo guardar la contraseña.');
      }
    } catch {
      setError('No se pudo guardar la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    router.push('/cursos');
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form} noValidate>
      <h2 className={styles.title}>
        {firstTime ? 'Configurá tu contraseña' : 'Cambiá tu contraseña'}
      </h2>
      <p className={styles.subtitle}>
        {firstTime
          ? 'Opcional. Podés ingresar siempre con un link al mail.'
          : 'Elegí una nueva contraseña.'}
      </p>

      {error && (
        <div
          id="set-pw-error"
          className={styles.error}
          role="alert"
          aria-live="assertive"
        >
          {error}
        </div>
      )}

      <Input
        label="Contraseña"
        type="password"
        name="password"
        id="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Mínimo 8 caracteres, al menos 1 símbolo"
        required
        autoComplete="new-password"
        aria-describedby={error ? 'set-pw-error' : 'pw-hint'}
      />

      <Input
        label="Repetí la contraseña"
        type="password"
        name="confirm"
        id="confirm"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="Repetí tu contraseña"
        required
        autoComplete="new-password"
        aria-describedby={error ? 'set-pw-error' : undefined}
      />

      <p id="pw-hint" className={styles.hint}>
        Mínimo 8 caracteres e incluí al menos un símbolo (! ? # _ . etc.).
      </p>

      <Button type="submit" loading={loading} className={styles.submitButton}>
        Guardar contraseña
      </Button>

      {firstTime && (
        <button
          type="button"
          className={styles.skipLink}
          onClick={handleSkip}
        >
          Listo, podés saltar este paso si querés
        </button>
      )}
    </form>
  );
};
