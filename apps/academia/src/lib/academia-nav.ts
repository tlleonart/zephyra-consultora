import { INSTITUTIONAL_HOME } from './institutional-links';

/**
 * academia-nav — la navegación PROPIA de la Academia.
 *
 * POR QUÉ EXISTE. `institutional-links.ts` dejó esta decisión reservada por
 * escrito: la barra de la Academia heredó tal cual los seis enlaces del sitio
 * institucional (Inicio · Servicios · Equipo · Proyectos · Perspectivas ·
 * Contacto), que hablan de la consultora y no del producto. Una alumna adentro
 * del catálogo tenía seis maneras de irse de la Academia y ninguna de moverse
 * dentro de ella. Tomás lo resolvió el 2026-09-25: la barra de la Academia es
 * de la Academia.
 *
 * ESTE MÓDULO NO REEMPLAZA A `institutional-links`. Aquel sigue siendo el que
 * arma los enlaces HACIA el sitio institucional —el pie los usa enteros, y acá
 * se usa uno solo, el de volver a Zephyra— y sigue siendo el único lugar donde
 * vive el origen de www. Lo que cambia es QUÉ muestra la barra, no CÓMO se
 * arman esas URLs.
 *
 * QUÉ NO ESTÁ ACÁ, a propósito: las entradas de la cuenta (Mis cursos, Mi
 * cuenta, Privacidad, Mi empresa). Ésas salen de `accountMenuLinks`, que ya es
 * su única fuente y ya aplica la regla de "Mi empresa sólo para la dueña". Si
 * se repitieran acá habría dos listas que pueden divergir.
 */
export interface AcademiaNavLink {
  href: string;
  label: string;
  /** `true` cuando el destino es otro host (el sitio institucional). */
  external?: boolean;
}

/**
 * La casa de la Academia. La marca de la barra apunta acá y no al sitio
 * institucional: quien toca el logo de la Academia estando en un curso quiere
 * la Academia, no irse del producto. (El enlace para irse existe igual, abajo,
 * con nombre propio.)
 */
export const ACADEMIA_HOME = '/';

export const ACADEMIA_NAV_LINKS: readonly AcademiaNavLink[] = [
  { href: ACADEMIA_HOME, label: 'Inicio' },
  { href: '/cursos', label: 'Cursos' },
  { href: '/empresa', label: 'Para empresas' },
  // El camino de vuelta a la consultora, explícito y nombrado. Antes eran seis
  // enlaces institucionales sin decir que te sacaban de la Academia.
  { href: INSTITUTIONAL_HOME, label: 'Zephyra', external: true },
] as const;

/**
 * El ingreso, SÓLO sin sesión.
 *
 * La barra pre-split no ofrecía ingresar, con el argumento de que el llamado a
 * la acción del producto es comprar y la ficha del curso ya lleva a
 * autenticarse. En el testing eso se pagó caro: las testers, ya con cuenta, no
 * encontraban dónde entrar y terminaban dando vueltas por el alta. Con sesión
 * no aparece —ahí está el menú de cuenta— así que no compite con nada.
 */
export const ACADEMIA_SIGNIN_LINK: AcademiaNavLink = {
  href: '/cursos/auth/signin',
  label: 'Ingresar',
};
