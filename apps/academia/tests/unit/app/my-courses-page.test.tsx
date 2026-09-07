/**
 * T-fe-007 — `/cursos/mis-cursos`.
 *
 * Cubre AC 5 (lista lo que corresponde, y el estado vacío tiene salida) y AC 6
 * (Continuar entra al curso correcto).
 *
 * La página es un server component `async` que lee la cookie y consulta Convex,
 * así que no se puede renderizar en este runner. Lo que SÍ se renderiza es todo
 * lo que la página compone —la tarjeta, la señal de avance, el estado vacío— y
 * eso es donde vive lo que puede salir mal en silencio: un destino equivocado,
 * un porcentaje inventado, un "0 de 0". De la página se afirma la estructura:
 * el portón, la query que consume, la clave de lista y que no reordene.
 *
 * Que la query devuelva las matrículas correctas y excluya las vencidas lo fija
 * el lado de Convex, y no se replica acá.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
// El consumidor real usa <Link>: el fixture usa el mismo elemento.
import Link from 'next/link';
import { MyCourseCard } from '@/components/public/MyCourseCard';
import {
  coursePositionLabel,
  type CoursePosition,
} from '@/components/public/CoursePositionLabel';
import {
  EmptyCoursesState,
  EMPTY_CATALOG_TEXT,
} from '@/components/public/EmptyCoursesState';

const APP = path.resolve(__dirname, '../../..');
const SRC = path.join(APP, 'src');
const PAGE_DIR = path.join(SRC, 'app', '(public)', 'cursos', 'mis-cursos');
const read = (p: string) => fs.readFileSync(p, 'utf8');

const BLOCK_COMMENT = new RegExp(String.raw`/\*[\s\S]*?\*/`, 'g');
const LINE_COMMENT = new RegExp(String.raw`^\s*//.*$`, 'gm');
const code = (src: string) => src.replace(BLOCK_COMMENT, '').replace(LINE_COMMENT, '');
const PAGE = () => code(read(path.join(PAGE_DIR, 'page.tsx')));

const position = (over: Partial<CoursePosition> = {}): CoursePosition => ({
  modulesSeen: 0,
  moduleTotal: 7,
  state: 'not-started',
  anyModuleAdvanced: false,
  ...over,
});

/** Dos filas con la forma exacta que devuelve la query. */
const ROWS = [
  {
    enrollmentId: 'kn7c2tmh0001',
    courseSlug: 'dei-en-entornos-laborales',
    courseTitle: 'DEI en entornos laborales',
    coverUrl: null,
    position: position({ modulesSeen: 5, moduleTotal: 7, state: 'in-progress' }),
  },
  {
    enrollmentId: 'kn7c2tmh0002',
    courseSlug: 'sostenibilidad-basica',
    courseTitle: 'Sostenibilidad básica',
    coverUrl: 'https://files.example.test/cover.png',
    position: position({ modulesSeen: 0, moduleTotal: 3 }),
  },
];

const renderCards = (rows: typeof ROWS) =>
  renderToStaticMarkup(
    <ul>
      {rows.map((r) => (
        <li key={r.enrollmentId}>
          <MyCourseCard
            courseSlug={r.courseSlug}
            courseTitle={r.courseTitle}
            coverUrl={r.coverUrl}
            position={r.position}
          />
        </li>
      ))}
    </ul>
  );

describe('la señal de avance es un CONTEO, y ninguna de sus formas miente', () => {
  it('con avance dice cuántos módulos vio sobre el total', () => {
    expect(
      coursePositionLabel(position({ modulesSeen: 5, moduleTotal: 7, state: 'in-progress' }))
    ).toEqual({ state: 'En curso', detail: '5 de 7 módulos vistos' });
  });

  it('nunca dice un porcentaje', () => {
    const todas = [
      position({ modulesSeen: 5, moduleTotal: 7, state: 'in-progress' }),
      position({ modulesSeen: 7, moduleTotal: 7, state: 'completed' }),
      position({ modulesSeen: 0, moduleTotal: 7 }),
      position({ modulesSeen: 0, moduleTotal: 0 }),
    ].map(coursePositionLabel);

    for (const t of todas) {
      expect(`${t.state} ${t.detail ?? ''}`).not.toMatch(/%|por ?ciento/i);
    }
  });

  it('moduleTotal === 0 NO pinta "0 de 0 módulos vistos" — pinta el estado solo', () => {
    // Es un caso real: un curso sin scoStructure. "0 de 0" además afirmaría que
    // el curso no tiene contenido, y eso no es lo que sabemos: lo que sabemos
    // es que no conocemos el total.
    const t = coursePositionLabel(position({ modulesSeen: 0, moduleTotal: 0 }));
    expect(t.detail).toBeNull();
    expect(t.state).toBe('Todavía no empezaste');
  });

  it('sin empezar muestra el tamaño del curso, no un cero redundante', () => {
    expect(coursePositionLabel(position({ modulesSeen: 0, moduleTotal: 7 }))).toEqual({
      state: 'Todavía no empezaste',
      detail: '7 módulos',
    });
  });

  it('concuerda en singular cuando el curso tiene un solo módulo', () => {
    expect(
      coursePositionLabel(position({ modulesSeen: 0, moduleTotal: 1 })).detail
    ).toBe('1 módulo');
    expect(
      coursePositionLabel(
        position({ modulesSeen: 1, moduleTotal: 1, state: 'completed' })
      )
    ).toEqual({ state: 'Completado', detail: '1 de 1 módulo visto' });
  });

  it('los tres estados tienen copia propia', () => {
    expect(coursePositionLabel(position({ state: 'not-started' })).state).toBe(
      'Todavía no empezaste'
    );
    expect(
      coursePositionLabel(position({ state: 'in-progress', modulesSeen: 1 })).state
    ).toBe('En curso');
    expect(
      coursePositionLabel(position({ state: 'completed', modulesSeen: 7 })).state
    ).toBe('Completado');
  });

  it('el caso de las testers se mueve: abrieron módulos sin marcar ninguno como hecho', () => {
    // Con el cálculo viejo veían 0%. Con el conteo, la pantalla dice algo
    // distinto al principio y después de cursar.
    const alPrincipio = coursePositionLabel(position({ modulesSeen: 0, moduleTotal: 7 }));
    const despues = coursePositionLabel(
      position({ modulesSeen: 5, moduleTotal: 7, state: 'in-progress', anyModuleAdvanced: true })
    );
    expect(despues).not.toEqual(alPrincipio);
    expect(despues.detail).toBe('5 de 7 módulos vistos');
  });
});

describe('AC 6 — Continuar entra al curso correcto', () => {
  it('el destino es el reproductor de ESE curso', () => {
    const html = renderCards(ROWS);
    expect(html).toContain('href="/cursos/dei-en-entornos-laborales/player"');
    expect(html).toContain('href="/cursos/sostenibilidad-basica/player"');
  });

  it('no lleva a la ficha del curso: la alumna ya compró, no hay nada que decidir', () => {
    const html = renderCards([ROWS[0]]);
    expect(html).not.toContain('href="/cursos/dei-en-entornos-laborales"');
  });

  it('cada Continuar se distingue de los otros para un lector de pantalla', () => {
    // Cinco enlaces que dicen "Continuar" son indistinguibles al navegar por
    // enlaces.
    const html = renderCards(ROWS);
    expect(html).toContain('aria-label="Continuar DEI en entornos laborales"');
    expect(html).toContain('aria-label="Continuar Sostenibilidad básica"');
  });

  it('la tarjeta NO se envuelve entera en un enlace: dejaría el botón anidado', () => {
    const html = renderCards([ROWS[0]]);
    expect(html.startsWith('<ul><li><article')).toBe(true);
  });
});

describe('AC 5 — lista lo que corresponde', () => {
  it('con una matrícula aparece ese curso y sólo ése', () => {
    const html = renderCards([ROWS[0]]);
    expect(html.match(/<article/g)).toHaveLength(1);
    expect(html).toContain('DEI en entornos laborales');
    expect(html).not.toContain('Sostenibilidad básica');
  });

  it('con dos matrículas aparecen las dos, cada una con su avance', () => {
    const html = renderCards(ROWS);
    expect(html.match(/<article/g)).toHaveLength(2);
    expect(html).toContain('5 de 7 módulos vistos');
    expect(html).toContain('3 módulos');
  });

  it('la portada faltante usa el mismo tratamiento del catálogo, no un roto', () => {
    // Hoy en staging no hay NINGUNA portada cargada: éste es el caso normal, y
    // dos de tres testers lo reportaron como falla.
    const html = renderCards([ROWS[0]]);
    expect(html).toContain('◆');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('<img');
  });

  it('con portada se pinta la imagen', () => {
    const html = renderCards([ROWS[1]]);
    expect(html).toContain('<img');
    expect(html).not.toContain('◆');
  });
});

describe('AC 5 — el estado vacío reusa el del catálogo, con salida y sin mentirle', () => {
  it('la página usa EmptyCoursesState y no escribe uno nuevo', () => {
    const src = PAGE();
    expect(src).toContain('EmptyCoursesState');
    expect(src).toContain('href="/cursos"');
  });

  it('NO reusa el texto del catálogo, que acá sería falso', () => {
    // "Próximamente nuevos cursos" le diría a una alumna sin matrículas que
    // todavía no publicamos nada. Hay catálogo; lo que no tiene es un curso
    // suyo.
    expect(PAGE()).not.toContain('Próximamente');
  });

  it('el estado vacío del catálogo NO cambió: mismo texto, y sin salida', () => {
    // /cursos y / comparten este componente. Parametrizar la copia no puede
    // haberles movido el marcado.
    const html = renderToStaticMarkup(<EmptyCoursesState />);
    expect(html).toContain(EMPTY_CATALOG_TEXT);
    expect(html).not.toContain('<a');
    expect(html).toContain('✦');
  });

  it('con salida, la pinta debajo del texto', () => {
    const html = renderToStaticMarkup(
      <EmptyCoursesState
        text="Todavía no tenés cursos."
        action={<Link href="/cursos">Ver el catálogo</Link>}
      />
    );
    expect(html).toContain('Todavía no tenés cursos.');
    expect(html).toContain('href="/cursos"');
    expect(html.indexOf('Todavía no tenés cursos.')).toBeLessThan(html.indexOf('href="/cursos"'));
  });
});

describe('la página: portón, contrato y orden', () => {
  it('es force-dynamic y server component', () => {
    const src = PAGE();
    expect(src).toMatch(/export const dynamic\s*=\s*'force-dynamic'/);
    expect(src).toMatch(/export default async function MyCoursesPage/);
    expect(src).not.toMatch(/^['"]use client['"]/m);
  });

  it('tiene su propio portón, con el mismo returnTo que emite el middleware', () => {
    const src = PAGE();
    expect(src).toContain('getLearnerSession');
    expect(src).toContain(
      "redirect('/cursos/auth/signin?returnTo=/cursos/mis-cursos')"
    );
  });

  it('consume listMyCoursesWithProgress con el learnerId de la sesión', () => {
    const src = PAGE();
    expect(src).toContain('api.lms.enrollments.listMyCoursesWithProgress');
    expect(src).toContain('learnerId: session.learnerId');
  });

  it('NO reordena: el orden por más recién tocada viene de la query', () => {
    // "Seguir donde iba" es el gesto de la pantalla. Reordenar acá por título o
    // por estado lo rompería sin que nada chille.
    const src = PAGE();
    expect(src).not.toMatch(/\.sort\(/);
    expect(src).not.toMatch(/\.reverse\(/);
  });

  it('la clave de lista es enrollmentId, no el slug', () => {
    // Una misma persona puede tener dos matrículas al mismo curso (una
    // individual y una por asiento): con el slug, React colapsaría las filas.
    expect(PAGE()).toContain('key={enrollment.enrollmentId}');
  });

  it('no toca progressPercent ni ninguna barra de porcentaje', () => {
    const src = PAGE();
    expect(src).not.toContain('progressPercent');
    expect(src).not.toContain('progressbar');
    expect(src).not.toContain('%');
  });

  it('hace un solo viaje: no resuelve portadas por su cuenta', () => {
    const src = PAGE();
    expect(src).toContain('coverUrl');
    expect(src).not.toContain('toCourseCards');
    expect(src).not.toContain('getUrl');
  });

  it('la señal de avance vive en un componente propio, para que sea reversible', () => {
    // La spec pide que el día que el porcentaje sea honesto, la barra reemplace
    // al texto sin tocar el resto de la pantalla.
    expect(
      fs.existsSync(
        path.join(SRC, 'components/public/CoursePositionLabel/CoursePositionLabel.tsx')
      )
    ).toBe(true);
    expect(PAGE()).not.toContain('módulos vistos');
  });

  it('las hojas de estilo usan tokens, no literales de color', () => {
    for (const css of [
      path.join(PAGE_DIR, 'MyCourses.module.css'),
      path.join(SRC, 'components/public/MyCourseCard/MyCourseCard.module.css'),
      path.join(SRC, 'components/public/CoursePositionLabel/CoursePositionLabel.module.css'),
    ]) {
      const body = read(css).replace(/\/\*[\s\S]*?\*\//g, '');
      expect(body, css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(body, css).not.toMatch(/\brgba?\(/);
    }
  });

  it('los blancos táctiles de la pantalla son de 44px', () => {
    expect(
      read(path.join(SRC, 'components/public/MyCourseCard/MyCourseCard.module.css'))
    ).toMatch(/\.action\s*\{[^}]*min-height:\s*44px/);
    expect(read(path.join(PAGE_DIR, 'MyCourses.module.css'))).toMatch(
      /\.emptyAction\s*\{[^}]*min-height:\s*44px/
    );
  });
});
