/**
 * UAT1 / U3 — `/empresa` deja de rebotar, y el rebote no puede volver.
 *
 * LO QUE SE FIJA ACA, Y POR QUE. Las tres paginas de (empresa) gateaban por ROL
 * mandando a `signin?returnTo=<la misma pagina>`. Con una sesion viva eso ya
 * era un callejon —el middleware devolvia al catalogo y la propuesta B2B
 * quedaba inalcanzable, que es lo que reportaron las testers— y desde que el
 * middleware respeta el `returnTo` (U2) pasa a ser un BUCLE INFINITO: la pagina
 * manda a signin, signin devuelve a la pagina, la pagina manda a signin.
 * Verificado: sin este cambio, /empresa con sesion da ERR_TOO_MANY_REDIRECTS.
 *
 * La regla que queda fijada es una sola y vale para las tres: a `signin` se
 * manda SOLO a quien no tiene sesion. A quien tiene sesion pero no es duena se
 * la manda a una superficie que existe para ella. Si alguien vuelve a escribir
 * el gate viejo, estos tests caen.
 *
 * Son tests estructurales sobre la fuente, como los de account-page.test.ts:
 * son server components `async` que llaman `getLearnerSession()`, asi que
 * renderizarlos exige un contexto de request. La propiedad que importa —a
 * donde manda cada rama— se lee en el codigo.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const APP = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(p, 'utf8');

const BLOCK_COMMENT = new RegExp(String.raw`/\*[\s\S]*?\*/`, 'g');
const LINE_COMMENT = new RegExp(String.raw`^\s*//.*$`, 'gm');
/** Los docblocks CITAN el gate viejo para explicarlo; las reglas se leen en codigo. */
const code = (src: string) =>
  src.replace(BLOCK_COMMENT, '').replace(LINE_COMMENT, '');

const empresaPage = () =>
  code(read(path.join(APP, 'src/app/(empresa)/empresa/page.tsx')));
const empresaCursos = () =>
  code(read(path.join(APP, 'src/app/(empresa)/empresa/cursos/page.tsx')));
const empresaCursoSlug = () =>
  code(read(path.join(APP, 'src/app/(empresa)/empresa/cursos/[slug]/page.tsx')));
const landing = () =>
  code(
    read(
      path.join(
        APP,
        'src/features/org-landing/components/B2BLanding/B2BLanding.tsx'
      )
    )
  );

describe('U3 — /empresa resuelve por tipo de sesion en vez de rebotar', () => {
  it('no manda a signin: ese era el rebote que se volvio bucle', () => {
    expect(empresaPage()).not.toContain('auth/signin?returnTo=/empresa');
  });

  it('muestra la propuesta publica a quien no es duena de empresa', () => {
    const src = empresaPage();
    expect(src).toContain('<B2BLanding />');
    expect(src).toMatch(/session\.type !== 'org_admin'/);
  });

  it('la duena SIN organizacion sigue yendo al alta, no a la propuesta', () => {
    expect(empresaPage()).toContain("redirect('/empresa/registro')");
  });

  it('la duena CON organizacion sigue viendo su panel', () => {
    expect(empresaPage()).toContain('OrgDashboard');
  });
});

describe('U3 — el catalogo para equipos no rebota a una puerta ya cruzada', () => {
  const casos: Array<[string, () => string, string]> = [
    ['/empresa/cursos', empresaCursos, '/empresa/cursos'],
    ['/empresa/cursos/[slug]', empresaCursoSlug, '/empresa/cursos/'],
  ];

  it.each(casos)(
    '%s manda a signin SOLO cuando no hay sesion',
    (_ruta, src, returnTo) => {
      const s = src();
      // La rama de signin existe y esta gateada por ausencia de sesion.
      expect(s).toMatch(/if \(!session\) \{\s*redirect\(/);
      expect(s).toContain(returnTo);
      // Y NO esta gateada por rol: `!session || session.type !== ...` es el
      // gate viejo, el que produce el bucle.
      expect(s).not.toMatch(/!session \|\| session\.type !== 'org_admin'/);
    }
  );

  it.each(casos)(
    '%s manda a la propuesta cuando hay sesion pero no es duena',
    (_ruta, src) => {
      const s = src();
      expect(s).toMatch(
        /if \(session\.type !== 'org_admin'\) \{\s*redirect\('\/empresa'\)/
      );
    }
  );
});

describe('U3 — la propuesta no inventa precios', () => {
  it('las bandas salen del modulo compartido, no escritas a mano', () => {
    const src = landing();
    expect(src).toContain("from '@/features/packs/lib/volume-bands'");
    expect(src).toContain('VOLUME_BANDS.map');
  });

  it('no escribe importes: el precio lo calcula el servidor', () => {
    const src = landing();
    // Los packs de tamano fijo con precio propio (USD 1050 / USD 2750) se
    // descartaron en el Sprint 3 a favor del descuento por volumen. Publicar
    // esos numeros seria publicar una lista de precios que el producto ya no
    // aplica.
    expect(src).not.toMatch(/USD\s*\d/);
    expect(src).not.toMatch(/\bUS\$/);
    expect(src).not.toMatch(/\b(1050|2750)\b/);
  });

  it('la unica llamada a la accion lleva al alta de empresa', () => {
    expect(landing()).toContain('href="/empresa/registro"');
  });
});
