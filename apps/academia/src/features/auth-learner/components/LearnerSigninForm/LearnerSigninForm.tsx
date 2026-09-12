'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@zephyra/ui';
import { Button } from '@zephyra/ui';
import { requestMagicLink } from '../../actions/request-magic-link';
import { signInLearnerWithPassword } from '../../actions/signin-password';
import styles from './LearnerSigninForm.module.css';

/**
 * UAT1 / U6 — lo que la pantalla dice cuando se pide el link.
 *
 * EL DEFECTO QUE REPORTARON. "Poniendo el correo para que envien el link, no
 * llega. Solo llega si se toca '¿No tenes cuenta? Empeza'." Tenian razon: con
 * un correo que todavia no tiene cuenta no se manda nada, y la pantalla igual
 * afirmaba "Te enviamos un link. Revisa tu mail". Quedaban esperando un mail
 * que no existia, sin ninguna salida a la vista.
 *
 * POR QUE NO SE MANDA. `requestMagicLink` (Convex) tira "usuario no encontrado"
 * para un correo no registrado, y la accion de Next colapsa CUALQUIER error en
 * un exito opaco a proposito: es anti-enumeracion, para que nadie pueda sondear
 * que direcciones tienen cuenta. Tomas la ratifico el 2026-09-12: se sostiene.
 * Asi que el backend no cambia; cambia lo que la pantalla afirma.
 *
 * DE PASO, LA RAMA MUERTA. Habia un `else` con el mensaje anti-enumeracion
 * correcto que NO SE EJECUTABA NUNCA: la accion devuelve `success: true`
 * siempre, justamente por el disenio de arriba. El mensaje bueno estaba
 * escrito y era inalcanzable. Ahora hay uno solo, que es la otra mitad del
 * requisito: la respuesta tiene que ser indistinguible entre un correo que
 * existe y uno que no. Dos mensajes distintos serian el oraculo que la
 * anti-enumeracion viene a evitar.
 *
 * LO QUE PROPUSIERON ELLAS, aplicado un paso despues. Sugerian sacar el campo
 * de correo y dejar solo "Empeza" y "Recuperalo". Eso resuelve el sintoma pero
 * rompe a quien SI tiene cuenta y quiere entrar, que es el caso normal. Las
 * dos salidas van donde hacian falta: en la pantalla donde antes se quedaban
 * esperando.
 */
const MAGIC_LINK_REQUESTED_MESSAGE =
  'Si ese correo tiene una cuenta, en un minuto te llega el link para entrar.';

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
        // Un solo mensaje, gane o pierda: la respuesta tiene que ser la misma
        // para un correo que existe y para uno que no. `result.success` es
        // siempre true por disenio de la accion, asi que la rama que habia
        // aca nunca corria.
        void result;
        setSuccessMessage(MAGIC_LINK_REQUESTED_MESSAGE);
      }
    } catch {
      if (mode === 'password') {
        setError('credenciales inválidas');
      } else {
        setSuccessMessage(MAGIC_LINK_REQUESTED_MESSAGE);
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
      {/* El subtitulo describe el METODO, y solo tiene sentido mientras el
          formulario esta a la vista. Dejarlo puesto en el estado de exito
          reponia la misma afirmacion que U6 vino a sacar —"te enviamos un
          link"— justo arriba del mensaje que dice que capaz no. */}
      {!successMessage && (
        <p className={styles.subtitle}>
          {mode === 'magic'
            ? 'Te mandamos un link al mail para entrar. Sin contraseñas.'
            : 'Ingresá con tu email y contraseña.'}
        </p>
      )}

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

      {successMessage && (
        <div className={styles.successHelp}>
          <p className={styles.successHelpText}>
            Revisá también el correo no deseado. Si no llega nada, puede ser que
            esa dirección todavía no tenga cuenta.
          </p>
          <div className={styles.successHelpActions}>
            <Link href="/cursos/auth/signup" className={styles.footerLink}>
              ¿No tenés cuenta? Empezá
            </Link>
            <Link href="/cursos/auth/recovery" className={styles.footerLink}>
              ¿Perdiste el acceso? Recuperalo
            </Link>
          </div>
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

      {/* En el estado de exito las mismas dos salidas ya se ofrecen arriba,
          pegadas al mensaje. Repetirlas seria pintarlas dos veces. */}
      {!successMessage && (
        <div className={styles.footerLinks}>
          <Link href="/cursos/auth/signup" className={styles.footerLink}>
            ¿No tenés cuenta? Empezá
          </Link>
          <Link href="/cursos/auth/recovery" className={styles.footerLink}>
            ¿Perdiste el acceso? Recuperalo
          </Link>
        </div>
      )}
    </form>
  );
};
