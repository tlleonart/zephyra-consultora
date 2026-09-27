/**
 * Las cabeceras HTTP compartidas (ops/http-headers.mjs).
 *
 * LA QUE IMPORTA ES x-frame-options. El reproductor muestra el curso de CAMPUS
 * en un <iframe> del MISMO origen, para que el contenido pueda encontrar la API
 * de SCORM caminando `window.parent`. `DENY` prohíbe todo embebido, incluido el
 * propio: el curso dejaría de verse. Y fallaría en producción, no acá, salvo
 * que este test exista.
 */
import { describe, it, expect } from 'vitest';
import { buildHeaders } from '../../../../../ops/http-headers.mjs';

const valores = async () => {
  const reglas = await buildHeaders();
  return Object.fromEntries(reglas[0].headers.map((h) => [h.key, h.value]));
};

describe('cabeceras compartidas', () => {
  it('nunca emite DENY: rompería el reproductor', async () => {
    const h = await valores();
    expect(h['x-frame-options']).toBe('SAMEORIGIN');
    expect(h['x-frame-options']).not.toBe('DENY');
  });

  it('declara nosniff siempre', async () => {
    expect((await valores())['x-content-type-options']).toBe('nosniff');
  });

  it('NO decide la indexacion: eso vive en robots.ts, en tiempo de ejecucion', async () => {
    // Estuvo aca y estuvo mal: la cabecera se hornea al compilar, asi que
    // cambiar la variable no tenia efecto hasta el proximo build y mientras
    // tanto robots.txt decia lo contrario. Una sola fuente, y que se lea en
    // cada visita.
    expect(await valores()).not.toHaveProperty('x-robots-tag');
  });

  it('cubre todas las rutas, no sólo la home', async () => {
    const reglas = await buildHeaders();
    expect(reglas).toHaveLength(1);
    expect(reglas[0].source).toBe('/:path*');
  });
});
