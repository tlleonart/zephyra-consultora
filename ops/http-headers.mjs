/**
 * Cabeceras HTTP compartidas por las tres apps.
 *
 * UN SOLO ARCHIVO, y no una copia por app, porque son una regla de seguridad:
 * tres copias divergen y la que se olvida no avisa. Cada `next.config.ts` lo
 * importa desde acá.
 *
 * ─── x-frame-options: SAMEORIGIN, NUNCA "DENY" ──────────────────────────────
 * Esto es load-bearing y por eso está escrito. El reproductor muestra el curso
 * de CAMPUS dentro de un <iframe> servido por el MISMO origen (el proxy de
 * assets, `/api/lms/asset/...`), justamente para que el contenido pueda
 * encontrar la API de SCORM caminando `window.parent`. `DENY` prohíbe todo
 * embebido, incluido el del propio sitio: el curso dejaría de verse. `SAMEORIGIN`
 * permite ese caso y sigue bloqueando el clickjacking desde afuera.
 *
 * ─── indexación: CERRADA POR DEFECTO ────────────────────────────────────────
 * La variable habilita la indexación (`ZEPHYRA_INDEXABLE=true`), no la
 * prohíbe. Es al revés de lo intuitivo y es a propósito: si se prohibiera con
 * una variable, olvidarla en un entorno de prueba lo deja indexable —y el
 * olvido no avisa, se descubre buscando en Google—. Al revés, el olvido deja un
 * entorno sin indexar, que es molesto pero inocuo y lo detecta el chequeo de
 * `ops/verificar-produccion.mjs` el mismo día del pase.
 *
 * O sea: hoy, sin tocar nada, los entornos de prueba dejan de indexarse. El día
 * que exista producción, ESA variable se pone ahí y sólo ahí.
 */

/** @typedef {{ key: string, value: string }} Cabecera */

/**
 * @param {{ noindex?: boolean }} opciones
 * @returns {Promise<Array<{ source: string, headers: Cabecera[] }>>}
 */
export async function buildHeaders({ noindex = true } = {}) {
  /** @type {Cabecera[]} */
  const cabeceras = [
    // El navegador respeta el Content-Type declarado en vez de adivinarlo.
    { key: 'x-content-type-options', value: 'nosniff' },
    // Ver arriba: SAMEORIGIN, nunca DENY.
    { key: 'x-frame-options', value: 'SAMEORIGIN' },
  ];

  if (noindex) {
    cabeceras.push({ key: 'x-robots-tag', value: 'noindex, nofollow' });
  }

  return [{ source: '/:path*', headers: cabeceras }];
}

/**
 * Lee la decisión del entorno. Sólo produce `false` —es decir, "indexame"—
 * cuando la variable está puesta explícitamente. Ver el docblock.
 */
export const noindexDesdeEntorno = () => process.env.ZEPHYRA_INDEXABLE !== 'true';
