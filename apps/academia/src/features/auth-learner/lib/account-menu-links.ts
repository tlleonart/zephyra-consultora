import type { PublicLearnerSession } from './public-session';

/**
 * Las entradas de navegación del área de cuenta de la alumna, en un solo lugar.
 *
 * POR QUÉ NO ESTÁN ESCRITAS DENTRO DEL MENÚ. El área de cuenta se pinta DOS
 * veces: como menú desplegable en escritorio y como bloque dentro del menú
 * móvil, que es una superficie a pantalla completa con otra tipografía, otro
 * fondo y otro tratamiento. Son dos renderizados y una sola lista. Si cada uno
 * escribiera la suya, la regla de "Mi empresa" —la única condicional que hay
 * acá— se cumpliría en uno y se olvidaría en el otro, y el olvido sería
 * invisible: para verlo habría que abrir el teléfono con una sesión de
 * `org_admin`. Con una sola lista, el test que fija la regla la fija en los dos.
 */
export interface AccountMenuLink {
  id: string;
  label: string;
  href: string;
  /**
   * Sirve para separar visualmente los grupos sin que ningún renderizado tenga
   * que saber cuántas entradas hay ni en qué orden. Un separador va donde el
   * grupo cambia.
   */
  group: 'cuenta' | 'empresa';
}

/**
 * `Mi empresa` aparece SÓLO para `org_admin`.
 *
 * No es decoración: una dueña de empresa que está navegando el catálogo hoy no
 * tiene forma de volver a su panel sin escribir la dirección a mano. Y no puede
 * aparecer para `individual` ni para `org_learner` — la primera no tiene
 * empresa, y la segunda no es dueña de la suya; a las dos `/empresa` las
 * rebota, así que ofrecerles el enlace sería mandarlas a una puerta cerrada.
 *
 * `Privacidad` va SIN CONDICIÓN, y merece una nota porque no es obvio. La
 * página `/cursos/privacidad` hoy rebota a `/cursos` a quien no tenga
 * `organizationId`, o sea a una alumna `individual`. Aun así el enlace se
 * ofrece a todas, porque es exactamente lo que ya hace el otro acceso: el
 * enlace del encabezado del reproductor tampoco discrimina. Ocultarlo acá
 * haría que las dos puertas a la misma página se comportaran distinto, y sería
 * decidir por producto que una alumna sin empresa no tiene superficie de
 * derechos de datos. Esa decisión no se toma desde acá.
 */
export const accountMenuLinks = (
  type: PublicLearnerSession['type']
): AccountMenuLink[] => {
  const links: AccountMenuLink[] = [
    { id: 'mis-cursos', label: 'Mis cursos', href: '/cursos/mis-cursos', group: 'cuenta' },
    { id: 'mi-cuenta', label: 'Mi cuenta', href: '/cursos/cuenta', group: 'cuenta' },
    { id: 'privacidad', label: 'Privacidad', href: '/cursos/privacidad', group: 'cuenta' },
  ];

  if (type === 'org_admin') {
    links.push({ id: 'mi-empresa', label: 'Mi empresa', href: '/empresa', group: 'empresa' });
  }

  return links;
};

/**
 * La inicial que se pinta en el círculo del disparador.
 *
 * Sale del CORREO porque no hay de dónde más: `lmsCustomers` no tiene campo de
 * nombre, así que no existe un "nombre de la alumna" que mostrar.
 *
 * Se toma con el iterador de cadena y no con `[0]`: `charAt(0)` parte los pares
 * subrogados, así que un correo que empiece con un carácter fuera del plano
 * básico pintaría medio carácter. Y si el correo llegara vacío se devuelve un
 * marcador en vez de una cadena vacía, que dejaría el círculo mudo.
 */
export const learnerInitial = (email: string): string => {
  const first = [...email.trim()][0];
  return first ? first.toLocaleUpperCase('es-AR') : '?';
};
