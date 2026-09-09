import { Navbar } from '@/components/public/Navbar';
import { Footer } from '@/components/public/Footer';
import { getLearnerSession } from '@/features/auth-learner/lib/session';
import { toPublicLearnerSession } from '@/features/auth-learner/lib/public-session';
import styles from './layout.module.css';

/**
 * Shell del grupo (public). Desde T-fe-003 es un server component `async` que
 * resuelve la sesión de la alumna y se la baja a la barra.
 *
 * POR QUÉ ACÁ Y NO EN LA BARRA. `Navbar` es `"use client"` (estado de scroll y
 * menú móvil) y `getLearnerSession()` lee `cookies()`, que sólo existe del lado
 * del servidor. El camino ya estaba escrito en este repo: `(empresa)/layout.tsx`
 * es exactamente este patrón — layout `async`, `getLearnerSession()`, resultado
 * bajado a la barra. Se espeja, no se inventa (SPEC §4).
 *
 * LO QUE NO SE HACE: pedir la sesión desde el cliente con `fetch` o con un
 * endpoint nuevo. Agrega un viaje de red, hace parpadear la barra en cada carga
 * (AC 13) y abre una superficie de identidad que hoy no existe.
 *
 * LO QUE VIAJA: `toPublicLearnerSession` recorta el payload a `email` y `type`.
 * `learnerId`, `organizationId` y `exp` NO cruzan al navegador (AC 11).
 *
 * SOBRE VOLVERLO `async` (riesgo S4). Leer cookies fuerza render dinámico del
 * subárbol. No cambia nada acá: las 13 páginas del grupo ya declaran
 * `dynamic = "force-dynamic"` una por una — hay un test que lo fija, así que si
 * mañana alguien saca un `force-dynamic` se entera por qué importa.
 */
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = toPublicLearnerSession(await getLearnerSession());

  return (
    <div className={styles.layout}>
      <Navbar session={session} />
      <main className={styles.main}>{children}</main>
      <Footer />
    </div>
  );
}
