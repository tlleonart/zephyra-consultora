'use client';

import Link from 'next/link';
import { signOutLearner } from '@/features/auth-learner/actions/signout';
import { accountMenuLinks } from '@/features/auth-learner/lib/account-menu-links';
import type { PublicLearnerSession } from '@/features/auth-learner/lib/public-session';
import styles from './MobileAccountLinks.module.css';

/**
 * El área de cuenta dentro del menú móvil.
 *
 * POR QUÉ NO ES EL MISMO DESPLEGABLE QUE EN ESCRITORIO. El menú móvil ya es una
 * superficie a pantalla completa que se abrió con el hamburguesa. Meterle
 * adentro un desplegable sería una segunda capa de revelado para llegar a lo
 * mismo: dos toques donde alcanza uno, y un panel blanco flotando sobre un
 * overlay verde. Acá las entradas se despliegan planas, con el mismo
 * tratamiento que el resto de esa pantalla.
 *
 * LO QUE NO SE DUPLICA ES LA LISTA. Las entradas y la regla de "Mi empresa"
 * salen de `accountMenuLinks`, la misma que arma el desplegable de escritorio.
 * Son dos renderizados y un solo origen: si la regla se escribiera dos veces,
 * olvidarla acá sería invisible —habría que abrir un teléfono con una sesión de
 * dueña de empresa para notarlo.
 *
 * Los blancos táctiles de 44px se declaran en la hoja de al lado, no se heredan
 * del paquete: acá el elemento lo pinta esta app.
 */
export interface MobileAccountLinksProps {
  session: PublicLearnerSession;
  /** Cierra el menú móvil al navegar, igual que hacen los enlaces de arriba. */
  onNavigate: () => void;
}

export const MobileAccountLinks = ({
  session,
  onNavigate,
}: MobileAccountLinksProps) => (
  <>
    <li className={styles.divider} role="presentation" />
    <li className={styles.identity}>{session.email}</li>
    {accountMenuLinks(session.type).map((link) => (
      <li key={link.id}>
        <Link href={link.href} className={styles.link} onClick={onNavigate}>
          {link.label}
        </Link>
      </li>
    ))}
    <li>
      {/* El mismo patrón que el cierre de sesión de la superficie de empresa:
          un formulario contra la acción de servidor, que limpia la cookie y
          redirige. No hay estado de cliente que sincronizar. */}
      <form action={signOutLearner}>
        <button type="submit" className={styles.link}>
          Cerrar sesión
        </button>
      </form>
    </li>
  </>
);
