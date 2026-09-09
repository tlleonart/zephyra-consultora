import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getLearnerSession } from '@/features/auth-learner/lib/session';
import styles from './Account.module.css';

// force-dynamic: la sesión es una lectura por request. Igual que el resto del
// grupo (public), que ya declara force-dynamic página por página.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Mi cuenta — Zephyra',
};

/**
 * `/cursos/cuenta` — los datos de la alumna, y nada más.
 *
 * QUÉ HAY ACÁ Y POR QUÉ ES TAN POCO. El correo en lectura, un enlace para
 * cambiar la contraseña y otro a privacidad. No hay más campos que mostrar:
 * `lmsCustomers` no tiene nombre ni foto, así que "editar perfil" no es una
 * decisión de alcance sino una pantalla sin contenido posible. Recuperar
 * contraseña tampoco entra: ya existe en `/cursos/auth/recovery`, y es la
 * puerta para quien NO puede entrar; ésta es la de quien ya entró.
 *
 * EL GATE ESTÁ DOS VECES, A PROPÓSITO. El middleware ya protege esta ruta y
 * emite el `returnTo`, así que una visita sin sesión no llega hasta acá. La
 * llamada a `getLearnerSession()` es defensa en profundidad —el mismo patrón
 * que ya usan el reproductor y la página de privacidad— y además es lo que
 * trae el correo que se muestra: no es un guard duplicado por olvido, es la
 * lectura que la pantalla necesita igual.
 *
 * "CAMBIAR CONTRASEÑA" ES UN ENLACE Y NO UN FORMULARIO porque `/cursos/auth/
 * set-password` ya resuelve eso para una alumna con sesión iniciada. Hasta
 * hace poco esa ruta era inalcanzable: el middleware la listaba entre las que
 * mintean sesión y rebotaba a quien ya la tenía. Ese arreglo es lo que hace
 * que este enlace lleve a algún lado.
 */
export default async function LearnerAccountPage() {
  const session = await getLearnerSession();
  if (!session) {
    redirect('/cursos/auth/signin?returnTo=/cursos/cuenta');
  }

  return (
    <main className={styles.wrapper}>
      <div className={styles.header}>
        <Link href="/cursos" className={styles.backLink}>
          ← Volver al catálogo
        </Link>
        <p className={styles.eyebrow}>Mi cuenta</p>
        <h1 className={styles.title}>Mis datos</h1>
      </div>

      <section className={styles.card} aria-labelledby="datos-de-acceso">
        <h2 id="datos-de-acceso" className={styles.cardTitle}>
          Datos de acceso
        </h2>

        <dl className={styles.field}>
          <dt className={styles.fieldLabel}>Correo electrónico</dt>
          {/* En lectura: el correo identifica la cuenta y cambiarlo es cambiar
              de cuenta. No hay flujo de verificación para moverlo, así que
              ofrecer un campo editable prometería algo que no existe. */}
          <dd className={styles.fieldValue}>{session.email}</dd>
        </dl>

        <Link href="/cursos/auth/set-password" className={styles.action}>
          Cambiar mi contraseña
        </Link>
      </section>

      <section className={styles.card} aria-labelledby="mis-datos-privacidad">
        <h2 id="mis-datos-privacidad" className={styles.cardTitle}>
          Mi progreso y mi privacidad
        </h2>
        <p className={styles.cardText}>
          Elegí qué se comparte sobre tu avance y revisá tus preferencias cuando
          quieras.
        </p>
        <Link href="/cursos/privacidad" className={styles.action}>
          Ir a privacidad
        </Link>
      </section>
    </main>
  );
}
