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

const valores = async (opciones = {}) => {
  const reglas = await buildHeaders(opciones);
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

  it('CERRADO POR DEFECTO: sin decir nada, no se indexa', async () => {
    // Al revés de lo intuitivo, y a propósito: olvidar la variable deja un
    // entorno sin indexar (inocuo) en vez de dejar staging compitiendo con
    // producción en Google (silencioso y caro).
    expect((await valores())['x-robots-tag']).toBe('noindex, nofollow');
  });

  it('sólo se indexa cuando el entorno lo habilita explícitamente', async () => {
    expect(await valores({ noindex: false })).not.toHaveProperty('x-robots-tag');
  });

  it('cubre todas las rutas, no sólo la home', async () => {
    const reglas = await buildHeaders();
    expect(reglas).toHaveLength(1);
    expect(reglas[0].source).toBe('/:path*');
  });
});
