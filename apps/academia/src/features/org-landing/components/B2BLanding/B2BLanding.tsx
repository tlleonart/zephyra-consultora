import Link from 'next/link';
import { btnClass } from '@zephyra/ui';
import { VOLUME_BANDS } from '@/features/packs/lib/volume-bands';
import type { PublicLearnerSession } from '@/features/auth-learner/lib/public-session';
import { OrgAccountSwitch } from '../OrgAccountSwitch';
import styles from './B2BLanding.module.css';

/**
 * UAT1 / U3 — la propuesta para organizaciones, para quien todavia no es duena
 * de una empresa en la plataforma.
 *
 * POR QUE EXISTE. Hasta ahora /empresa ERA el panel de la duena y nada mas: a
 * cualquier otra persona la rebotaba a `signin?returnTo=/empresa`, y el
 * middleware —viendo una sesion valida sobre una ruta de auth— la devolvia al
 * catalogo. Resultado: la banda de la portada invitaba a "Conoce la propuesta
 * B2B" y el boton llevaba al catalogo B2C, sin un solo mensaje. Las testers lo
 * reportaron tres veces sin darse cuenta de que era lo mismo: "/empresa se
 * transforma en el link de cursos", "no puedo ver el pack, solo comprar uno", y
 * el boton del telefono. No faltaba un arreglo: faltaba esta pagina.
 *
 * QUE NO HACE. No cotiza. El precio sale por curso y por cantidad de cupos, y
 * lo calcula el servidor (`computePackPrice`) dentro del catalogo para equipos,
 * ya con la organizacion creada. Aca se explica la escala para que se entienda
 * antes de registrarse; las bandas salen de features/packs/lib/volume-bands.ts,
 * la misma lista que pinta la calculadora, para que las dos no puedan divergir.
 *
 * NO ES UNA PAGINA DE PRECIOS CERRADOS. El modelo vigente es descuento por
 * volumen sobre el precio de cada curso — los "packs" de tamano fijo con precio
 * propio se descartaron en el Sprint 3 a favor de esta configuracion. Si alguna
 * vez vuelve un precio fijo, vuelve por la config, no por este archivo.
 */
export interface B2BLandingProps {
  /** La sesion abierta, si hay. Aca nunca es de una duena: a ella /empresa le muestra el panel. */
  session?: PublicLearnerSession | null;
}

export function B2BLanding({ session = null }: B2BLandingProps) {
  return (
    <div className={styles.wrapper}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Para organizaciones</p>
        <h1 className={styles.title}>Formá a tu equipo en diversidad e inclusión</h1>
        <p className={styles.lead}>
          Sumá cupos para las personas de tu organización, repartilos cuando
          quieras y seguí el avance del equipo desde un panel propio.
        </p>
        <div className={styles.heroActions}>
          <Link
            href="/empresa/registro"
            className={btnClass({ size: 'lg', variant: 'inverse' })}
          >
            Registrá tu empresa
          </Link>
          <Link href="/cursos" className={styles.secondaryLink}>
            Ver el catálogo de cursos
          </Link>
        </div>
      </header>

      <section className={styles.section} aria-labelledby="como-funciona">
        <h2 id="como-funciona" className={styles.sectionTitle}>
          Cómo funciona
        </h2>
        <ol className={styles.steps}>
          <li className={styles.step}>
            <span className={styles.stepNum} aria-hidden="true">
              1
            </span>
            <h3 className={styles.stepTitle}>Registrás tu empresa</h3>
            <p className={styles.stepText}>
              Creás la organización con tu correo. Toma menos de un minuto y no
              requiere que nadie más se registre todavía.
            </p>
          </li>
          <li className={styles.step}>
            <span className={styles.stepNum} aria-hidden="true">
              2
            </span>
            <h3 className={styles.stepTitle}>Elegís el curso y cuántos cupos</h3>
            <p className={styles.stepText}>
              El precio se calcula sobre el valor del curso por la cantidad de
              cupos, con el descuento por volumen que corresponda.
            </p>
          </li>
          <li className={styles.step}>
            <span className={styles.stepNum} aria-hidden="true">
              3
            </span>
            <h3 className={styles.stepTitle}>Repartís los cupos</h3>
            <p className={styles.stepText}>
              Invitás por correo a quien quieras. Si alguien deja el equipo,
              liberás su cupo y se lo das a otra persona.
            </p>
          </li>
        </ol>
      </section>

      <section className={styles.section} aria-labelledby="escala">
        <h2 id="escala" className={styles.sectionTitle}>
          Cuantos más cupos, menor el precio por persona
        </h2>
        <p className={styles.sectionLead}>
          El descuento se aplica solo, según la cantidad de cupos que compres de
          un curso. El total exacto lo vas a ver antes de pagar.
        </p>
        <ul className={styles.bands} role="list">
          {VOLUME_BANDS.map((band) => (
            <li key={band.label} className={styles.band}>
              <span className={styles.bandLabel}>{band.label}</span>
              <span
                className={
                  band.contact ? styles.bandValueContact : styles.bandValue
                }
              >
                {band.discountLabel}
              </span>
            </li>
          ))}
        </ul>
        <p className={styles.note}>
          Para 50 lugares o más armamos una propuesta a medida: escribinos y la
          preparamos con vos.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="incluye">
        <h2 id="incluye" className={styles.sectionTitle}>
          Lo que incluye
        </h2>
        <ul className={styles.features} role="list">
          <li className={styles.feature}>
            <h3 className={styles.featureTitle}>Los cupos no vencen</h3>
            <p className={styles.featureText}>
              Comprás una vez y los usás cuando el equipo esté listo. No hay
              plazo para asignarlos.
            </p>
          </li>
          <li className={styles.feature}>
            <h3 className={styles.featureTitle}>Cupos reasignables</h3>
            <p className={styles.featureText}>
              Si una persona todavía no empezó el curso, podés liberar su cupo y
              dárselo a otra.
            </p>
          </li>
          <li className={styles.feature}>
            <h3 className={styles.featureTitle}>Panel de organización</h3>
            <p className={styles.featureText}>
              Vas a ver cuántos cupos compraste, cuántos están asignados y cómo
              avanza el equipo en cada curso.
            </p>
          </li>
          <li className={styles.feature}>
            <h3 className={styles.featureTitle}>El avance individual es privado</h3>
            <p className={styles.featureText}>
              El panel muestra el avance del equipo de forma agregada. Para ver
              el detalle de una persona hace falta que ella lo autorice.
            </p>
          </li>
        </ul>
      </section>

      <section className={styles.closing}>
        <h2 className={styles.closingTitle}>¿Empezamos?</h2>
        <p className={styles.closingText}>
          Registrá tu empresa y armá la primera compra cuando quieras. No hay
          nada que pagar para crear la organización.
        </p>
        <Link
          href="/empresa/registro"
          className={btnClass({ size: 'lg', variant: 'inverse' })}
        >
          Registrá tu empresa
        </Link>
        {session ? (
          <OrgAccountSwitch email={session.email} className={styles.signinHint} />
        ) : (
          <p className={styles.signinHint}>
            ¿Ya tenés una empresa registrada?{' '}
            <Link href="/cursos/auth/signin?returnTo=/empresa" className={styles.signinLink}>
              Iniciá sesión
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
