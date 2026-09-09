/**
 * T-fe-008 — `/cursos/cuenta`.
 *
 * Cubre AC 7 (la página está protegida y con sesión responde) y AC 12 (el
 * enlace a privacidad llega a la misma página que el del reproductor).
 *
 * La mitad de AC 7 que vive en el middleware —sin sesión, 307 a `signin` con su
 * `returnTo`— ya está fijada en tests/unit/middleware.test.ts, y no se repite
 * acá. Lo que se fija acá es la otra mitad: que la página exista donde el
 * middleware la gatea, que tenga su propio portón, y que lo que muestra sea lo
 * que se decidió mostrar y nada más.
 *
 * Es un server component `async` que llama `getLearnerSession()`, así que
 * renderizarlo exige `cookies()` de Next y por lo tanto un contexto de request.
 * Sin ese contexto, lo verificable es la estructura del módulo — y es donde
 * viven las propiedades que importan.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const APP = path.resolve(__dirname, '../../..');
const PAGE_DIR = path.join(APP, 'src', 'app', '(public)', 'cursos', 'cuenta');
const read = (p: string) => fs.readFileSync(p, 'utf8');

const BLOCK_COMMENT = new RegExp(String.raw`/\*[\s\S]*?\*/`, 'g');
const LINE_COMMENT = new RegExp(String.raw`^\s*//.*$`, 'gm');
/** El docblock CITA lo que la página no hace; las prohibiciones se leen en código. */
const code = (src: string) => src.replace(BLOCK_COMMENT, '').replace(LINE_COMMENT, '');

const PAGE = () => code(read(path.join(PAGE_DIR, 'page.tsx')));

describe('AC 7 — la página existe donde el middleware la gatea, y se protege sola', () => {
  it('la ruta es /cursos/cuenta dentro del grupo (public)', () => {
    expect(fs.existsSync(path.join(PAGE_DIR, 'page.tsx'))).toBe(true);
  });

  it('es force-dynamic: la sesión es una lectura por request', () => {
    expect(PAGE()).toMatch(/export const dynamic\s*=\s*'force-dynamic'/);
  });

  it('es un server component async — no lleva "use client"', () => {
    const src = PAGE();
    expect(src).toMatch(/export default async function LearnerAccountPage/);
    expect(src).not.toMatch(/^['"]use client['"]/m);
  });

  it('tiene su propio portón y redirige con el mismo returnTo que emite el middleware', () => {
    // Defensa en profundidad, y además la lectura que la pantalla necesita
    // igual: de ahí sale el correo que muestra.
    const src = PAGE();
    expect(src).toContain('getLearnerSession');
    expect(src).toContain("redirect('/cursos/auth/signin?returnTo=/cursos/cuenta')");
  });
});

describe('la página muestra lo que se decidió mostrar, y nada más', () => {
  it('el correo va en LECTURA, no en un campo editable', () => {
    const src = PAGE();
    expect(src).toContain('session.email');
    // Cambiar el correo es cambiar de cuenta, y no hay flujo de verificación
    // para moverlo: un campo editable prometería algo que no existe.
    expect(src).not.toMatch(/<input/i);
    expect(src).not.toMatch(/<form/i);
  });

  it('enlaza a cambiar contraseña, que es alcanzable desde que se destrabó la ruta', () => {
    expect(PAGE()).toContain('href="/cursos/auth/set-password"');
  });

  it('AC 12 — enlaza a privacidad, la misma ruta que la puerta del reproductor', () => {
    expect(PAGE()).toContain('href="/cursos/privacidad"');
  });

  it('no entra nada de lo que quedó fuera de alcance', () => {
    const src = PAGE();
    // Recuperar contraseña ya vive en /cursos/auth/recovery, y es la puerta
    // para quien NO puede entrar; ésta es la de quien ya entró.
    expect(src).not.toContain('/cursos/auth/recovery');
    // No hay campo de nombre ni de foto en lmsCustomers: no es alcance
    // recortado, es una pantalla sin contenido posible.
    expect(src).not.toMatch(/\bnombre\b/i);
    expect(src).not.toMatch(/\bfoto\b|\bavatar\b/i);
    expect(src).not.toMatch(/notificacion/i);
  });

  it('no consulta Convex: no hay nada que traer que la sesión no traiga', () => {
    const src = PAGE();
    expect(src).not.toContain('ConvexHttpClient');
    expect(src).not.toContain('api.lms');
  });

  it('los enlaces de acción son blancos táctiles de 44px y muestran el foco', () => {
    const css = read(path.join(PAGE_DIR, 'Account.module.css'));
    expect(css).toMatch(/\.action\s*\{[^}]*min-height:\s*44px/);
    expect(css).toContain('.action:focus,');
    expect(css).not.toMatch(/outline:\s*(none|0)/);
  });

  it('la hoja de estilo usa tokens, no literales de color', () => {
    const css = read(path.join(PAGE_DIR, 'Account.module.css')).replace(
      /\/\*[\s\S]*?\*\//g,
      ''
    );
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\brgba?\(/);
  });
});
