/**
 * UAT2 — lo que la pantalla dice de cada módulo.
 *
 * Natalia recorrió el curso y vio 0% sin explicación. El porcentaje no cambia
 * —cuenta módulos completos, y eso es lo que significa— pero al lado de cada
 * módulo ahora hay texto. Estos casos fijan esa copia, incluido el que nos
 * pasó de verdad: todas las secciones recorridas y el módulo sin completar.
 */
import { describe, it, expect } from 'vitest';
import { moduleStateText } from '../../../src/app/(public)/cursos/[slug]/player/moduleState';

describe('moduleStateText', () => {
  it('un módulo completo lo dice con todas las letras', () => {
    expect(moduleStateText(true, undefined)).toBe('Completo');
  });

  it('un módulo que nunca se tocó no dice nada', () => {
    expect(moduleStateText(false, undefined)).toBeNull();
    expect(
      moduleStateText(false, { sectionsDone: 0, currentSection: null, touched: false, advanced: false })
    ).toBeNull();
  });

  it('EL CASO REAL: 8 secciones recorridas y el curso igual lo da por incompleto', () => {
    expect(
      moduleStateText(false, { sectionsDone: 8, currentSection: 2, touched: true, advanced: true })
    ).toBe('En curso · 8 secciones recorridas');
  });

  it('una sola sección se dice en singular', () => {
    expect(
      moduleStateText(false, { sectionsDone: 1, currentSection: 2, touched: true, advanced: true })
    ).toBe('En curso · 1 sección recorrida');
  });

  it('sin secciones marcadas pero avanzando, se dice la posición', () => {
    // Las dos testers reales tienen `done` vacío con `actual` > 0: si sólo
    // mirásemos `done`, a ellas les diríamos que no hicieron nada.
    expect(
      moduleStateText(false, { sectionsDone: 0, currentSection: 7, touched: true, advanced: true })
    ).toBe('En curso · vas por la sección 7');
  });

  it('tocado pero en la primera sección: "Empezado", sin inventar avance', () => {
    expect(
      moduleStateText(false, { sectionsDone: 0, currentSection: 1, touched: true, advanced: false })
    ).toBe('Empezado');
  });

  it('nunca arma una fracción: el contenido no declara el total de secciones', () => {
    const textos = [
      moduleStateText(false, { sectionsDone: 8, currentSection: 2, touched: true, advanced: true }),
      moduleStateText(false, { sectionsDone: 0, currentSection: 7, touched: true, advanced: true }),
      moduleStateText(true, undefined),
    ];
    for (const t of textos) expect(t).not.toMatch(/\bde\s+\d+|\d+\s*\/\s*\d+|%/);
  });
});
