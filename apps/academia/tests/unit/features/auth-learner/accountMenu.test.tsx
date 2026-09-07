/**
 * T-fe-005 — el menú de cuenta en la barra.
 *
 * Cubre AC 2 (con sesión aparece la identidad), AC 3 y AC 4 (cerrar sesión
 * cierra de verdad, y `signOutLearner` deja de ser código muerto), AC 8 («Mi
 * empresa» respeta el tipo, con un caso por cada uno de los tres), AC 10 (el
 * menú de cuenta es alcanzable en el teléfono) y AC 12 (privacidad tiene dos
 * puertas).
 *
 * Sin DOM, por lo mismo que el resto de este directorio: el runner de este
 * workspace corre en node. Se prueban las dos capas verificables sin navegador
 * —la lista de entradas, que es donde vive toda la lógica condicional, y el
 * marcado servido— y se deja explícito lo que no. El recorrido con teclado del
 * desplegable ya está cubierto tecla por tecla en tests/unit/ui.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  accountMenuLinks,
  learnerInitial,
} from '@/features/auth-learner/lib/account-menu-links';
import { buildAccountMenuEntries } from '@/components/public/AccountMenu';
import { signOutLearner } from '@/features/auth-learner/actions/signout';
import type { PublicLearnerSession } from '@/features/auth-learner/lib/public-session';

process.env.NEXT_PUBLIC_WWW_URL = 'https://www.zephyra.test';

const APP = path.resolve(__dirname, '../../../..');
const SRC = path.join(APP, 'src');
const read = (p: string) => fs.readFileSync(p, 'utf8');

const BLOCK_COMMENT = new RegExp(String.raw`/\*[\s\S]*?\*/`, 'g');
const LINE_COMMENT = new RegExp(String.raw`^\s*//.*$`, 'gm');
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

const TYPES: PublicLearnerSession['type'][] = [
  'individual',
  'org_admin',
  'org_learner',
];

const sessionOf = (type: PublicLearnerSession['type']): PublicLearnerSession => ({
  email: 'nati@example.com',
  type,
});

let Navbar: typeof import('@/components/public/Navbar').Navbar;

beforeAll(async () => {
  ({ Navbar } = await import('@/components/public/Navbar'));
});

const renderNavbar = (session: PublicLearnerSession | null) =>
  renderToStaticMarkup(<Navbar session={session} />);

/** Los ids de las entradas accionables, en orden. */
const entryIds = (type: PublicLearnerSession['type']) =>
  buildAccountMenuEntries(sessionOf(type))
    .filter((e) => e.kind === 'custom' || e.kind === 'form')
    .map((e) => e.id);

describe('AC 8 — «Mi empresa» respeta el tipo de sesión', () => {
  it('aparece con type === "org_admin"', () => {
    expect(accountMenuLinks('org_admin').map((l) => l.id)).toContain('mi-empresa');
    expect(entryIds('org_admin')).toContain('mi-empresa');
  });

  it('NO se renderiza para "individual"', () => {
    expect(accountMenuLinks('individual').map((l) => l.id)).not.toContain('mi-empresa');
    expect(entryIds('individual')).not.toContain('mi-empresa');
    expect(renderNavbar(sessionOf('individual'))).not.toContain('Mi empresa');
  });

  it('NO se renderiza para "org_learner"', () => {
    expect(accountMenuLinks('org_learner').map((l) => l.id)).not.toContain('mi-empresa');
    expect(entryIds('org_learner')).not.toContain('mi-empresa');
    expect(renderNavbar(sessionOf('org_learner'))).not.toContain('Mi empresa');
  });

  it('apunta a /empresa, que es el panel al que hoy sólo se llega escribiendo la dirección', () => {
    const link = accountMenuLinks('org_admin').find((l) => l.id === 'mi-empresa');
    expect(link?.href).toBe('/empresa');
  });

  it('los otros tres enlaces son iguales para los tres tipos', () => {
    // Lo único que discrimina es «Mi empresa». Si mañana alguien condiciona
    // otro enlace por tipo, este test lo obliga a decirlo acá.
    for (const type of TYPES) {
      expect(
        accountMenuLinks(type)
          .filter((l) => l.group === 'cuenta')
          .map((l) => l.href)
      ).toEqual(['/cursos/mis-cursos', '/cursos/cuenta', '/cursos/privacidad']);
    }
  });
});

describe('AC 2 — con sesión aparece la identidad', () => {
  it('el correo es el nombre accesible del disparador', () => {
    const html = renderNavbar(sessionOf('individual'));
    expect(html).toContain('aria-label="Mi cuenta — nati@example.com"');
  });

  it('el disparador declara aria-haspopup y arranca colapsado', () => {
    const html = renderNavbar(sessionOf('individual'));
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
  });

  it('la inicial se pinta y NO se anuncia dos veces', () => {
    // Repite el correo, que ya está en el nombre accesible: leerla otra vez
    // haría que un lector diga "N, Mi cuenta nati@…".
    const html = renderNavbar(sessionOf('individual'));
    expect(html).toContain('<span aria-hidden="true">N</span>');
  });

  it('la inicial sale del correo, que es el único dato de identidad que hay', () => {
    // lmsCustomers no tiene campo de nombre: no hay un "nombre de la alumna".
    expect(learnerInitial('nati@example.com')).toBe('N');
    expect(learnerInitial('  marcos@example.com ')).toBe('M');
    expect(learnerInitial('Ángela@example.com')).toBe('Á');
  });

  it('la inicial no parte caracteres fuera del plano básico ni deja el círculo mudo', () => {
    // charAt(0) partiría el par subrogado y pintaría medio carácter.
    expect(learnerInitial('𝕫ephyra@example.com')).toBe('𝕫');
    expect(learnerInitial('')).toBe('?');
    expect(learnerInitial('   ')).toBe('?');
  });

  it('el correo aparece como identidad no accionable dentro del menú', () => {
    const identidad = buildAccountMenuEntries(sessionOf('individual'))[0];
    expect(identidad.kind).toBe('label');
    expect(identidad).toMatchObject({ content: 'nati@example.com' });
  });
});

describe('AC 3 y AC 4 — cerrar sesión cierra de verdad', () => {
  it('la última entrada es un formulario contra signOutLearner', () => {
    const entries = buildAccountMenuEntries(sessionOf('individual'));
    const salir = entries[entries.length - 1];
    expect(salir.kind).toBe('form');
    expect(salir).toMatchObject({ id: 'cerrar-sesion', label: 'Cerrar sesión' });
    // La MISMA función, no una envoltura que podría divergir.
    expect((salir as Extract<typeof salir, { kind: 'form' }>).action).toBe(
      signOutLearner
    );
  });

  it('espeja el patrón <form action={serverAction}> que ya usa la superficie de empresa', () => {
    const orgButton = code(
      read(
        path.join(
          SRC,
          'features/org-signup/components/OrgSignoutButton/OrgSignoutButton.tsx'
        )
      )
    );
    expect(orgButton).toContain('<form action={signOutOrg}>');
    // El equivalente de la alumna usa la misma forma en las dos superficies.
    const mobile = code(
      read(path.join(SRC, 'components/public/MobileAccountLinks/MobileAccountLinks.tsx'))
    );
    expect(mobile).toContain('<form action={signOutLearner}>');
  });

  it('signOutLearner limpia la cookie y aterriza en /cursos', () => {
    const action = code(read(path.join(SRC, 'features/auth-learner/actions/signout.ts')));
    expect(action).toContain('clearLearnerSessionCookie');
    expect(action).toContain("redirect('/cursos')");
  });

  it('AC 4 — signOutLearner deja de ser código muerto: tiene importadores en producción', () => {
    // Antes de esta tarea el único match del repo era su propia definición.
    const importers = walk(SRC, ['.ts', '.tsx'])
      .filter((f) => !f.endsWith(path.join('actions', 'signout.ts')))
      .filter((f) => /import\s+\{[^}]*signOutLearner/.test(code(read(f))))
      .map((f) => path.relative(SRC, f).replace(/\\/g, '/'));

    expect(importers.length).toBeGreaterThan(0);
    expect(importers.sort()).toEqual([
      'components/public/AccountMenu/AccountMenu.tsx',
      'components/public/MobileAccountLinks/MobileAccountLinks.tsx',
    ]);
  });
});

describe('AC 12 — privacidad tiene dos puertas, y llegan a la misma', () => {
  const PRIVACIDAD = '/cursos/privacidad';

  it('la puerta del menú apunta a la misma ruta que la del reproductor', () => {
    const desdeElMenu = accountMenuLinks('org_learner').find(
      (l) => l.id === 'privacidad'
    );
    expect(desdeElMenu?.href).toBe(PRIVACIDAD);

    const player = read(
      path.join(SRC, 'app/(public)/cursos/[slug]/player/ScormPlayer.tsx')
    );
    expect(player).toContain(`href="${PRIVACIDAD}"`);
  });

  it('el enlace del reproductor NO se movió: se agrega una segunda puerta, no se muda la primera', () => {
    // El reproductor es pantalla completa y no monta la barra. Sacarlo de ahí
    // dejaría a la alumna sin acceso justo mientras cursa.
    const player = read(
      path.join(SRC, 'app/(public)/cursos/[slug]/player/ScormPlayer.tsx')
    );
    expect(player).toContain('Privacidad de mi progreso');
  });

  it('la tercera puerta, /cursos/cuenta, llega al mismo lado', () => {
    const cuenta = code(read(path.join(SRC, 'app/(public)/cursos/cuenta/page.tsx')));
    expect(cuenta).toContain(`href="${PRIVACIDAD}"`);
  });
});

describe('AC 10 — el menú de cuenta es alcanzable en el teléfono', () => {
  it('las entradas se renderizan dentro del menú móvil, no sólo en el desplegable', () => {
    const html = renderNavbar(sessionOf('org_admin'));
    // El overlay móvil se pinta siempre en el marcado (se muestra por CSS), así
    // que sus enlaces tienen que estar servidos, no montados al abrir.
    for (const label of ['Mis cursos', 'Mi cuenta', 'Privacidad', 'Mi empresa']) {
      expect(html, `falta "${label}" en el menú móvil`).toContain(label);
    }
    expect(html).toContain('Cerrar sesión');
  });

  it('escritorio y teléfono comparten la lista: nadie puede olvidarse de «Mi empresa» en uno solo', () => {
    const desktop = code(
      read(path.join(SRC, 'components/public/AccountMenu/AccountMenu.tsx'))
    );
    const mobile = code(
      read(path.join(SRC, 'components/public/MobileAccountLinks/MobileAccountLinks.tsx'))
    );
    expect(desktop).toContain('accountMenuLinks');
    expect(mobile).toContain('accountMenuLinks');
    // Y ninguno de los dos re-escribe la condición por su cuenta.
    expect(desktop).not.toContain("=== 'org_admin'");
    expect(mobile).not.toContain("=== 'org_admin'");
  });

  it('los blancos táctiles del bloque móvil son de 44px y el foco se ve siempre', () => {
    const css = read(
      path.join(
        SRC,
        'components/public/MobileAccountLinks/MobileAccountLinks.module.css'
      )
    );
    expect(css).toMatch(/\.link\s*\{[^}]*min-height:\s*44px/);
    expect(css).toContain('.link:focus,');
    expect(css).not.toMatch(/outline:\s*(none|0)/);
  });

  it('el desplegable de escritorio se oculta en teléfono para no duplicar el acceso', () => {
    const css = read(
      path.join(SRC, 'components/public/AccountMenu/AccountMenu.module.css')
    );
    expect(css).toMatch(/@media \(max-width: 768px\)[\s\S]*display:\s*none/);
  });
});

describe('AC 1 — la barra sin sesión sigue sin cambiar, ahora que el menú existe', () => {
  it('sin sesión no se monta ni el disparador ni el bloque móvil', () => {
    const html = renderNavbar(null);
    for (const marker of [
      'aria-haspopup',
      'Cerrar sesión',
      'Mis cursos',
      'Mi cuenta',
      'Mi empresa',
      '/cursos/mis-cursos',
      '/cursos/cuenta',
    ]) {
      expect(html, `apareció "${marker}" sin sesión`).not.toContain(marker);
    }
  });
});

describe('AC 11 — con el menú montado la sesión sigue sin filtrarse', () => {
  it('el marcado con sesión no contiene nada más que el correo', () => {
    // El menú es la primera superficie capaz de filtrar identidad. La
    // proyección sigue siendo la única fuente: no hay learnerId que pintar.
    const html = renderNavbar(sessionOf('org_admin'));
    expect(html).toContain('nati@example.com');
    expect(html).not.toContain('learnerId');
    expect(html).not.toContain('organizationId');
    expect(html).not.toMatch(/"exp"/);
  });
});
