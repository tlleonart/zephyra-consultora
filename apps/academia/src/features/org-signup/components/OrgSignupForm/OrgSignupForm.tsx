'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@zephyra/ui';
import { Button } from '@zephyra/ui';
import { requestOrgSignup } from '../../actions/request-org-signup';
import styles from './OrgSignupForm.module.css';

/**
 * E1 — org sign-up step 1 (api-contract §1). Collects email + org name + admin
 * name (taxId optional, no CC at sign-up) and requests a magic link. On submit
 * we DO NOT create the org yet — the link verifies email control first; the
 * org is created on the empresa create-org step after the link is consumed.
 *
 * WCAG: labelled inputs (via the Input primitive), the success/error regions
 * are aria-live, and the success panel takes focus so a screen-reader user is
 * told to check their email.
 */
export const OrgSignupForm = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [orgName, setOrgName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [taxId, setTaxId] = useState('');
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

    if (orgName.trim().length === 0) {
      setError('Ingresá el nombre de tu organización.');
      return;
    }
    if (adminName.trim().length === 0) {
      setError('Ingresá tu nombre.');
      return;
    }

    setLoading(true);
    try {
      const result = await requestOrgSignup(
        email,
        orgName.trim(),
        adminName.trim(),
        taxId.trim() || undefined
      );
      if (result.success && result.alreadyActivated) {
        setSuccessMessage(
          'Esta cuenta ya está activada. Redirigiendo al ingreso…'
        );
        setTimeout(() => router.push('/cursos/auth/signin?returnTo=/empresa'), 1500);
      } else {
        setSuccessMessage(
          `Te enviamos un link a ${email}. Abrilo para verificar tu email y crear tu organización.`
        );
      }
    } catch {
      setError('No pudimos enviar el link. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form} noValidate>
      <h1 className={styles.title}>Creá la cuenta de tu empresa</h1>
      <p className={styles.subtitle}>
        Comprá cursos para tu equipo con precios por volumen. Te enviamos un link
        para verificar tu email — sin tarjeta hasta el momento de la compra.
      </p>

      {error && (
        <div
          id="org-signup-error"
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
          id="org-signup-success"
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
            label="Nombre de la organización"
            type="text"
            name="orgName"
            id="orgName"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Mi Empresa S.A."
            required
            autoComplete="organization"
          />

          <Input
            label="Tu nombre"
            type="text"
            name="adminName"
            id="adminName"
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            placeholder="Nombre y apellido"
            required
            autoComplete="name"
          />

          <Input
            label="Email"
            type="email"
            name="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vos@tuempresa.com"
            required
            autoComplete="email"
          />

          <Input
            label="CUIT (opcional)"
            type="text"
            name="taxId"
            id="taxId"
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            placeholder="30-12345678-9"
            hint="Lo podés agregar más adelante."
          />

          <Button type="submit" loading={loading} className={styles.submitButton}>
            Recibir link de verificación
          </Button>
        </>
      )}

      <Link href="/cursos/auth/signin?returnTo=/empresa" className={styles.footerLink}>
        ¿Ya tenés cuenta de empresa? Iniciá sesión
      </Link>
    </form>
  );
};
