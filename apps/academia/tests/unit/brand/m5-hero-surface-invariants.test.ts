/**
 * M-5 — el hero es ARENA, y la barra superior es PAPEL.
 *
 * Por qué existe este archivo. La pantalla 1 de la dirección C, que Zephyra
 * aprobó el 2026-07-27, pinta el hero con `linear-gradient(150deg, sand 0%,
 * paper 68%)` y la barra con `rgba(239,234,224,.9)` + blur. Los dos salieron
 * VERDES igual: el hero del catálogo desde el rebrand de julio, el de la
 * portada en el primer build de T-06. La causa era real — la barra reusada
 * dependía de un fondo oscuro para que su texto blanco pasara AA — pero el
 * efecto fue que se entregó la dirección B · Bosque, que es la que el cliente
 * NO eligió, en las dos pantallas más visibles.
 *
 * Y lo que lo hizo durar un mes no fue el color: fue un COMENTARIO en
 * CoursesPage.module.css que afirmaba «the approved direction paints the hero
 * as a green BAND». Invocaba la aprobación del cliente para justificar lo
 * contrario de lo aprobado, así que el siguiente que abriera el archivo leía
 * que el verde era correcto.
 *
 * Los invariantes de T-06 pasaron sin ver nada de esto porque sólo miran copy
 * y estructura. Este archivo cierra ese hueco: si alguien vuelve a pintar
 * cualquiera de los dos heroes con el verde de marca, o vuelve a poner la
 * barra sobre un velo negro, esto se pone rojo.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const APP = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(p, 'utf8');

const BLOCK_COMMENT = new RegExp(String.raw`/\*[\s\S]*?\*/`, 'g');
const code = (src: string) => src.replace(BLOCK_COMMENT, '');

/** El bloque de una regla `.clase { ... }`, sin comentarios. */
function rule(css: string, selector: string): string {
  const re = new RegExp(String.raw`${selector.replace('.', '\\.')}\s*\{([^}]*)\}`);
  const m = code(css).match(re);
  if (!m) throw new Error(`no encontré la regla ${selector}`);
  return m[1];
}

const HOME_CSS = read(path.join(APP, 'src/app/(public)/Home.module.css'));
const CATALOG_CSS = read(path.join(APP, 'src/app/(public)/cursos/CoursesPage.module.css'));
const NAV_CSS = read(path.join(APP, 'src/components/public/Navbar/Navbar.module.css'));
const NAV_TSX = read(path.join(APP, 'src/components/public/Navbar/Navbar.tsx'));

describe('M-5 — el hero de la portada y el del catálogo son arena, no verde', () => {
  for (const [nombre, css] of [
    ['portada', HOME_CSS],
    ['catálogo', CATALOG_CSS],
  ] as const) {
    it(`el hero de ${nombre} usa las superficies claras, no el verde de marca`, () => {
      const hero = rule(css, '.hero');
      expect(hero).toContain('--color-bg-secondary');
      expect(hero).toContain('--color-bg');
      // Lo que importa: que el verde de marca NO vuelva a ser la superficie.
      expect(hero).not.toContain('--color-brand-main');
      expect(hero).not.toContain('--color-brand-dark');
    });

    it(`el hero de ${nombre} mantiene el ángulo del mockup aprobado (150deg)`, () => {
      expect(rule(css, '.hero')).toMatch(/150deg/);
    });
  }

  it('ningún texto del hero quedó en blanco sobre la superficie clara', () => {
    // Los blancos que sobreviven son legítimos: viven en la banda B2B, que sí
    // es verde. Se los localiza por posición, después de `.band`.
    const cuerpo = code(HOME_CSS);
    const band = cuerpo.indexOf('.band');
    const antesDeLaBanda = band === -1 ? cuerpo : cuerpo.slice(0, band);
    expect(antesDeLaBanda).not.toMatch(/color:\s*white/);
    expect(antesDeLaBanda).not.toMatch(/color:\s*rgba\(\s*255/);
  });
});

describe('M-5 — la barra superior es papel translúcido con texto oscuro', () => {
  it('el fondo en reposo es papel, no un velo negro', () => {
    const header = rule(NAV_CSS, '.header');
    expect(header).toMatch(/background-color:\s*rgba\(\s*239,\s*234,\s*224/);
    expect(header).not.toMatch(/background-color:\s*rgba\(\s*0,\s*0,\s*0/);
  });

  it('el estado scrolleado también es papel', () => {
    expect(rule(NAV_CSS, '.header.scrolled')).not.toMatch(/rgba\(\s*0,\s*0,\s*0/);
  });

  it('los links de la barra usan el color de texto, no blanco', () => {
    expect(rule(NAV_CSS, '.navLink')).toContain('--color-text');
  });

  it('la marca conmuta con el estado del menú móvil', () => {
    // Con la barra en papel la marca va clara; con el menú abierto la barra se
    // transparenta sobre el overlay verde y la marca oscura DESAPARECE. Lo
    // encontré mirando la pantalla, no corriendo tests: la primera versión de
    // este cambio dejó el logo invisible en móvil y los once invariantes
    // seguían en verde. Por eso el guardarraíl ahora exige la conmutación.
    expect(NAV_TSX).toMatch(/tone=\{isMobileMenuOpen \? "onDark" : "onLight"\}/);
  });

  it('con el menú móvil abierto las líneas del hamburguesa vuelven a blanco', () => {
    // El overlay del menú es verde y la barra se transparenta encima. Sin esta
    // regla, oscurecer el hamburguesa deja el botón de cerrar invisible — que
    // es el defecto que este cambio habría introducido si nadie lo miraba.
    expect(code(NAV_CSS)).toMatch(
      /\.header\.menuOpen\s+\.hamburgerLine\s*\{[^}]*background-color:\s*white/
    );
  });
});

describe('M-5 — el comentario que justificaba el verde citando al cliente', () => {
  it('ya no afirma que la dirección aprobada pinta el hero verde', () => {
    expect(CATALOG_CSS).not.toMatch(/approved direction paints the hero as a green BAND/i);
  });
});
