'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { verifyAndCreateOrg } from '../../actions/verify-and-create-org';
import styles from './OrgCreateContent.module.css';

type Status = 'pending' | 'success' | 'error';

/**
 * E1 — org sign-up step 2 (api-contract §1). The magic link lands here with the
 * single-use token + the org details the owner typed in step 1. We consume the
 * link (proves email control + mints the learner session) and createOrganization
 * in one chained server action, then land the owner on their empresa console.
 *
 * Single-use guard (consumedRef) mirrors the learner verify flow: a magic link
 * is single-use, so we guard against React StrictMode's double-invoke in dev.
 *
 * WCAG: aria-live status/error regions; an explicit fallback link on error.
 */
export const OrgCreateContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const orgName = searchParams.get('orgName');
  const taxId = searchParams.get('taxId') ?? undefined;

  const [status, setStatus] = useState<Status>('pending');
  const [message, setMessage] = useState('Verificando tu email y creando tu organización…');
  const consumedRef = useRef(false);

  useEffect(() => {
    if (consumedRef.current) return;
    consumedRef.current = true;

    const run = async () => {
      if (!token || !orgName) {
        setStatus('error');
        setMessage('Link inválido. Faltan parámetros.');
        return;
      }

      const result = await verifyAndCreateOrg(token, orgName, taxId);

      if (!result.success) {
        setStatus('error');
        setMessage(result.error ?? 'No pudimos crear tu organización.');
        return;
      }

      setStatus('success');
      setMessage(
        result.alreadyExisted
          ? 'Ya tenías una organización. Te llevamos a tu panel…'
          : '¡Listo! Tu organización fue creada. Te llevamos a tu panel…'
      );
      setTimeout(() => {
        router.push('/empresa');
        router.refresh();
      }, 900);
    };

    void run();
  }, [token, orgName, taxId, router]);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Creando tu organización</h1>

      {status === 'pending' && (
        <>
          <div className={styles.spinner} aria-hidden="true" />
          <p className={styles.message} role="status" aria-live="polite">
            {message}
          </p>
        </>
      )}

      {status === 'success' && (
        <div className={styles.success} role="status" aria-live="polite">
          {message}
        </div>
      )}

      {status === 'error' && (
        <>
          <div className={styles.error} role="alert" aria-live="assertive">
            {message}
          </div>
          <Link href="/empresa/registro" className={styles.footerLink}>
            Volver a empezar
          </Link>
        </>
      )}
    </div>
  );
};
