import { signOutToOrgSignin } from '@/features/auth-learner/actions/signout';
import styles from './OrgAccountSwitch.module.css';

/**
 * UAT2 — el "Iniciá sesión" de empresa, cuando ya hay una sesión personal.
 *
 * Con una cuenta individual abierta, el enlace a `signin?returnTo=/empresa` no
 * lleva a ningún ingreso: el middleware ve la sesión y devuelve a /empresa, que
 * a quien no es dueña le muestra la propuesta pública. Así que el enlace
 * "funcionaba" y dejaba a la persona en el mismo lugar, sin una palabra.
 *
 * En su lugar se dice con qué cuenta está adentro y se ofrece salir de ésa e
 * ingresar con la de la empresa, en un solo toque.
 */
export interface OrgAccountSwitchProps {
  email: string;
  /** Sin clase, se pinta como nota centrada debajo de un formulario. */
  className?: string;
}

export const OrgAccountSwitch = ({ email, className }: OrgAccountSwitchProps) => (
  <form action={signOutToOrgSignin} className={className ?? styles.hint}>
    Estás con la cuenta personal de {email}.{' '}
    <button type="submit" className={styles.switchButton}>
      Salí e ingresá con la cuenta de tu empresa
    </button>
  </form>
);
