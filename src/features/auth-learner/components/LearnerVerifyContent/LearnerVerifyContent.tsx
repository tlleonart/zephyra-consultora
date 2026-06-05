'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { consumeMagicLink } from '../../actions/consume-magic-link';
import styles from './LearnerVerifyContent.module.css';

type Purpose = 'learner_activation' | 'learner_signin' | 'learner_recovery';
type Status = 'pending' | 'success' | 'error';

const isValidPurpose = (raw: string | null): raw is Purpose =>
  raw === 'learner_activation' ||
  raw === 'learner_signin' ||
  raw === 'learner_recovery';

export const LearnerVerifyContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const purposeRaw = searchParams.get('purpose');
  const returnTo = searchParams.get('returnTo');

  const [status, setStatus] = useState<Status>('pending');
  const [message, setMessage] = useState('Validando tu link…');
  // Guard against React 18+ StrictMode double-invocation in dev — consuming a
  // magic link is single-use, so a second consume in the same render cycle
  // would surface "este link ya fue usado". Mirror the C01 single-use contract.
  const consumedRef = useRef(false);

  useEffect(() => {
    if (consumedRef.current) return;
    consumedRef.current = true;

    const run = async () => {
      if (!token || !isValidPurpose(purposeRaw)) {
        setStatus('error');
        setMessage('Link inválido. Faltan parámetros.');
        return;
      }

      const result = await consumeMagicLink(token, purposeRaw);

      if (!result.success) {
        setStatus('error');
        setMessage(result.error ?? 'No pudimos validar tu link.');
        return;
      }

      setStatus('success');

      if (result.isActivation) {
        setMessage('Cuenta activada. Te llevamos a configurar tu contraseña…');
        setTimeout(() => {
          router.push('/cursos/auth/set-password?firstTime=true');
        }, 800);
      } else {
        setMessage('Bienvenido. Redirigiendo…');
        const dest = returnTo ?? '/cursos';
        setTimeout(() => {
          router.push(dest);
          router.refresh();
        }, 800);
      }
    };

    void run();
  }, [token, purposeRaw, returnTo, router]);

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Verificando…</h2>

      {status === 'pending' && (
        <>
          <div className={styles.spinner} aria-hidden="true" />
          <p
            className={styles.message}
            role="status"
            aria-live="polite"
          >
            {message}
          </p>
        </>
      )}

      {status === 'success' && (
        <div
          className={styles.success}
          role="status"
          aria-live="polite"
        >
          {message}
        </div>
      )}

      {status === 'error' && (
        <>
          <div
            className={styles.error}
            role="alert"
            aria-live="assertive"
          >
            {message}
          </div>
          <Link href="/cursos/auth/signin" className={styles.footerLink}>
            Volver al inicio de sesión
          </Link>
        </>
      )}
    </div>
  );
};
