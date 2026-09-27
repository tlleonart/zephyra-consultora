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
 * ─── LA INDEXACIÓN NO ESTÁ ACÁ, Y ES A PROPÓSITO ──────────────────────────
 * Estuvo, y estuvo mal: la cabecera se hornea CUANDO SE COMPILA, así que
 * cambiar la variable de entorno no tenía efecto hasta el próximo build, y
 * mientras tanto `robots.txt` —que sí se calcula en cada visita— decía lo
 * contrario. Dos fuentes que se contradicen y nadie se entera.
 *
 * La indexación se decide en UN solo lugar y en tiempo de ejecución:
 * `src/app/robots.ts` de cada app. Acá viven sólo cabeceras que no dependen
 * del entorno.
 */

/** @typedef {{ key: string, value: string }} Cabecera */

/** @returns {Promise<Array<{ source: string, headers: Cabecera[] }>>} */
export async function buildHeaders() {
  /** @type {Cabecera[]} */
  const cabeceras = [
    // El navegador respeta el Content-Type declarado en vez de adivinarlo.
    { key: 'x-content-type-options', value: 'nosniff' },
    // Ver arriba: SAMEORIGIN, nunca DENY.
    { key: 'x-frame-options', value: 'SAMEORIGIN' },
  ];

  return [{ source: '/:path*', headers: cabeceras }];
}
