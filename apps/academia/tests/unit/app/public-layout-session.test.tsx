/**
 * T-fe-003 — el layout público resuelve la sesión en el SERVIDOR.
 *
 * Cubre AC 1 (la barra sin sesión no cambió), AC 11 (nada de la sesión se filtra
 * al HTML servido), AC 13 (sin parpadeo: la sesión no se pide desde el cliente)
 * y AC 14 / riesgo S4 (volver `async` el layout no degrada ninguna página del
 * grupo, y no toca el reproductor).
 *
 * POR QUÉ SIN DOM. Este workspace corre vitest con `environment: "node"` y jsdom
 * NO es dependencia (ver el docblock de vitest.config.ts, que además explica por
 * qué el pragma de entorno es una trampa mientras el paquete no esté instalado
 * — y no se escribe acá ni de ejemplo, porque vitest lo lee del COMENTARIO y
 * este archivo moriría al colectar). Así que el render se hace con `react-dom/server`
 * `renderToStaticMarkup`, que es además exactamente la capa donde viven las dos
 * propiedades que importan acá: lo que se serializa hacia el navegador (AC 11) y
 * lo que se pinta en la primera respuesta, sin hidratación (AC 1, AC 13).
 * El comportamiento interactivo del menú se fija en Playwright (T-e2e-009).
 *
 * `NEXT_PUBLIC_WWW_URL` se setea ANTES del import dinámico: la barra importa
 * @/lib/institutional-links, que resuelve el origen en scope de módulo y TIRA si
 * falta (a propósito — ver el docblock de ese archivo).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { toPublicLearnerSession } from '@/features/auth-learner/lib/public-session';
import type { LearnerSessionPayload } from '@/features/auth-learner/lib/session';

process.env.NEXT_PUBLIC_WWW_URL = 'https://www.zephyra.test';

const APP = path.resolve(__dirname, '../../..');
const SRC = path.join(APP, 'src');
const PUBLIC_GROUP = path.join(SRC, 'app', '(public)');
const read = (p: string) => fs.readFileSync(p, 'utf8');

const BLOCK_COMMENT = new RegExp(String.raw`/\*[\s\S]*?\*/`, 'g');
const LINE_COMMENT = new RegExp(String.raw`^\s*//.*$`, 'gm');
/** Los comentarios de este sprint CITAN lo que se prohíbe; se lee sólo código. */
const code = (src: string) => src.replace(BLOCK_COMMENT, '').replace(LINE_COMMENT, '');

function walk(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.next' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, exts));
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

let Navbar: typeof import('@/components/public/Navbar').Navbar;

beforeAll(async () => {
  ({ Navbar } = await import('@/components/public/Navbar'));
});

/** Un payload completo, con los tres campos que NO pueden cruzar. */
const PAYLOAD = {
  learnerId: 'kn7c2tmh000000000000zzzz' as LearnerSessionPayload['learnerId'],
  email: 'nati@example.com',
  type: 'org_admin',
  organizationId: 'org-9f3a-not-for-the-browser',
  exp: 1893456000,
} satisfies LearnerSessionPayload;

/**
 * Cualquier marca de un control de cuenta en la barra. Si T-fe-005 agrega el
 * menú, estas marcas tienen que seguir SIN aparecer cuando no hay sesión.
 */
const ACCOUNT_MARKERS = [
  'aria-haspopup',
  'Cerrar sesión',
  'Cerrar sesion',
  'Mis cursos',
  'Mi cuenta',
  '/cursos/mis-cursos',
  '/cursos/cuenta',
];

/**
 * "Ingresar" SALIÓ de esa lista el 2026-09-25, a propósito.
 *
 * La barra pre-split no ofrecía ingresar, con el argumento de que el llamado a
 * la acción es comprar y la ficha del curso ya lleva a autenticarse. En el
 * testing eso se pagó: las testers, ya con cuenta, no encontraban dónde entrar.
 * Tomás pidió una barra propia de la Academia; ésta es parte de esa decisión.
 *
 * Lo que la lista sigue protegiendo es lo que importa: sin sesión no se pinta
 * NINGÚN control de CUENTA —ni menú, ni correo, ni cerrar sesión, ni las rutas
 * privadas—. Un enlace público al ingreso no es un control de cuenta.
 */

describe('AC 1 — la barra sin sesión no cambió', () => {
  it('sin sesión no pinta ningún control de cuenta', () => {
    const html = renderToStaticMarkup(<Navbar session={null} />);
    for (const marker of ACCOUNT_MARKERS) {
      expect(html, `apareció "${marker}" en la barra sin sesión`).not.toContain(marker);
    }
  });

  it('sin sesión SÍ ofrece la puerta de entrada, y con sesión NO (Tomás, 2026-09-25)', () => {
    const anonima = renderToStaticMarkup(<Navbar session={null} />);
    expect(anonima).toContain('/cursos/auth/signin');
    expect(anonima).toContain('Ingresar');
    // Con sesión no va: al lado está el menú de cuenta, y dos entradas para lo
    // mismo confunden.
    const conSesion = renderToStaticMarkup(
      <Navbar session={{ email: PAYLOAD.email, type: 'individual' }} />
    );
    expect(conSesion).not.toContain('Ingresar');
  });

  it('sin sesión pinta EXACTAMENTE lo mismo que antes de que la prop existiera', () => {
    // <Navbar /> es la invocación de antes de T-fe-003 (la prop es opcional).
    // Esta igualdad es la forma más fuerte de "no cambió": no depende de que la
    // lista de marcas de arriba esté completa.
    expect(renderToStaticMarkup(<Navbar session={null} />)).toBe(
      renderToStaticMarkup(<Navbar />)
    );
  });

  it('pinta la navegación PROPIA de la Academia, y el camino de vuelta a Zephyra', () => {
    const html = renderToStaticMarkup(<Navbar session={null} />);
    expect(html).toContain('<header');
    // La barra es de la Academia: Cursos y Para empresas, no las seis secciones
    // de la consultora (Tomás, 2026-09-25).
    expect(html).toContain('Cursos');
    expect(html).toContain('Para empresas');
    // Y el camino de vuelta sigue existiendo, con nombre propio y absoluto.
    expect(html).toContain('https://www.zephyra.test/');
    expect(html).toContain('Abrir menu'); // el hamburguesa móvil, intacto
  });

  it('las tres rutas de AC 1 (/, /cursos, /cursos/[slug]) las sirve ESTE layout y ninguna otra barra', () => {
    // La barra es una sola: si hubiera una segunda instancia en un layout
    // anidado, "la barra de /cursos" podría divergir sin que nada chille.
    const callSites = walk(SRC, ['.tsx'])
      .filter((f) => code(read(f)).includes('<Navbar'))
      .map((f) => path.relative(SRC, f).replace(/\\/g, '/'));
    expect(callSites).toEqual(['app/(public)/layout.tsx']);

    // Y las tres rutas cuelgan del grupo (public), sin layout intermedio que
    // reemplace el shell.
    for (const p of ['page.tsx', 'cursos/page.tsx', 'cursos/[slug]/page.tsx']) {
      expect(fs.existsSync(path.join(PUBLIC_GROUP, p))).toBe(true);
    }
    const intermediateLayouts = walk(PUBLIC_GROUP, ['.tsx'])
      .filter((f) => path.basename(f) === 'layout.tsx')
      .map((f) => path.relative(PUBLIC_GROUP, f).replace(/\\/g, '/'));
    expect(intermediateLayouts.sort()).toEqual([
      'cursos/[slug]/player/layout.tsx', // el reproductor, a pantalla completa
      'layout.tsx',
    ]);
  });
});

describe('AC 11 — la sesión no se filtra al HTML servido', () => {
  it('con sesión, el markup no contiene learnerId, organizationId ni exp', () => {
    const html = renderToStaticMarkup(
      <Navbar session={toPublicLearnerSession(PAYLOAD)} />
    );
    expect(html).not.toContain(PAYLOAD.learnerId);
    expect(html).not.toContain(PAYLOAD.organizationId);
    expect(html).not.toContain(String(PAYLOAD.exp));
    expect(html).not.toContain('learnerId');
    expect(html).not.toContain('organizationId');
  });

  it('el layout baja la PROYECCIÓN, no el payload — verificado en el código', () => {
    const src = code(read(path.join(PUBLIC_GROUP, 'layout.tsx')));
    expect(src).toContain('toPublicLearnerSession');
    // `session={session}` donde `session` ya es la proyección. Lo que no puede
    // aparecer es el resultado crudo de getLearnerSession bajando a la barra.
    expect(src).not.toMatch(/session=\{await getLearnerSession\(\)\}/);
    expect(src).toMatch(/toPublicLearnerSession\(await getLearnerSession\(\)\)/);
  });
});

describe('AC 13 — la sesión se resuelve en el servidor, la barra no parpadea', () => {
  it('el layout público es async y llama getLearnerSession()', () => {
    const src = code(read(path.join(PUBLIC_GROUP, 'layout.tsx')));
    expect(src).toMatch(/export default async function PublicLayout/);
    expect(src).toContain('getLearnerSession');
    expect(src).not.toMatch(/^['"]use client['"]/m);
  });

  it('ningún componente cliente pide la sesión — ni por import ni por fetch', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC, ['.tsx', '.ts'])) {
      const raw = read(file);
      if (!/^['"]use client['"]/m.test(raw)) continue;
      const body = code(raw);
      // El import del TIPO es correcto y se borra en compilación; el que no
      // puede existir es el import de valor de getLearnerSession.
      if (/import\s+(?!type\b)[^;]*getLearnerSession/.test(body)) {
        offenders.push(`${path.relative(SRC, file)} — importa getLearnerSession`);
      }
      if (/fetch\([^)]*session/i.test(body)) {
        offenders.push(`${path.relative(SRC, file)} — hace fetch de la sesión`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no existe una ruta de API que devuelva la sesión de la alumna', () => {
    const apiDir = path.join(SRC, 'app', 'api');
    const routes = fs.existsSync(apiDir)
      ? walk(apiDir, ['.ts', '.tsx']).map((f) =>
          path.relative(apiDir, f).replace(/\\/g, '/')
        )
      : [];
    expect(routes.filter((r) => /session|sesion|whoami/i.test(r))).toEqual([]);
  });
});

describe('AC 14 / riesgo S4 — volver async el layout no degrada el grupo (public)', () => {
  it('TODA página del grupo declara force-dynamic, así que leer cookies no cambia su render', () => {
    // Eran 13 cuando el layout se volvió async, y todas ya eran force-dynamic:
    // por eso volverlo async no degradó nada. El número crece con el sprint, así
    // que lo que se afirma es la PROPIEDAD, no el conteo — una página nueva sin
    // force-dynamic es lo único que este test tiene que atrapar.
    const pages = walk(PUBLIC_GROUP, ['.tsx']).filter(
      (f) => path.basename(f) === 'page.tsx'
    );
    expect(pages.length).toBeGreaterThanOrEqual(13);
    const missing = pages
      .filter(
        (f) => !/export const dynamic\s*=\s*["']force-dynamic["']/.test(code(read(f)))
      )
      .map((f) => path.relative(PUBLIC_GROUP, f).replace(/\\/g, '/'));
    expect(missing).toEqual([]);
  });

  it('el reproductor sigue sin montar la barra: su layout no la importa', () => {
    const playerLayout = code(
      read(path.join(PUBLIC_GROUP, 'cursos/[slug]/player/layout.tsx'))
    );
    expect(playerLayout).not.toContain('Navbar');
    expect(playerLayout).not.toContain('Footer');
  });

  it('el enlace de privacidad del reproductor NO se movió — se agrega un segundo, no se muda el primero', () => {
    // SPEC §3.5. El reproductor es pantalla completa y no monta la barra; sacar
    // el enlace de ahí dejaría a la alumna sin acceso justo mientras cursa.
    const player = read(
      path.join(PUBLIC_GROUP, 'cursos/[slug]/player/ScormPlayer.tsx')
    );
    expect(player).toContain('/cursos/privacidad');
  });
});
