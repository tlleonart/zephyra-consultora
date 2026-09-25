import { requireOrigin } from '@zephyra/utils';

/**
 * academia-link — el enlace del sitio institucional HACIA la Academia.
 *
 * Existe porque la Academia vive en otro host: un href relativo sería un 404
 * silencioso (el mismo error que ya se pagó al revés, ver
 * apps/academia/src/lib/institutional-links.ts). `requireOrigin` falla en el
 * build si falta la variable, en vez de fallar cuando alguien hace clic.
 *
 * Lectura ESTÁTICA de process.env a propósito: Next reemplaza `NEXT_PUBLIC_*`
 * sólo cuando la propiedad se lee así; un acceso dinámico queda `undefined` en
 * el bundle del navegador.
 */
const ACADEMIA_ORIGIN = requireOrigin(
  'NEXT_PUBLIC_ACADEMIA_URL',
  process.env.NEXT_PUBLIC_ACADEMIA_URL
);

/** La casa de la Academia: el catálogo con los cursos y los dos formatos. */
export const ACADEMIA_HOME_URL = `${ACADEMIA_ORIGIN}/`;

/**
 * La etiqueta se escribe una sola vez. Es una MARCA, no un rótulo de menú: se
 * pinta con el mismo tratamiento tipográfico que el descriptor del logo de la
 * Academia (sans, 600, versalitas, tracking 0.14em).
 */
export const ACADEMIA_LABEL = 'ACADEMIA';
