/**
 * EL ÁREA DE CUENTA, EN UN NAVEGADOR DE VERDAD.
 *
 * Cubre lo que los tests de unidad NO pueden probar y que por eso quedó
 * marcado como parcial: que el foco EFECTIVAMENTE se mueva, que el anillo SE
 * VEA, que los blancos táctiles MIDAN 44px (no que estén declarados en una
 * hoja), y que la barra llegue ya con la sesión puesta en lugar de cambiar
 * después de hidratar.
 *
 * La máquina de teclado ya está probada tecla por tecla, pura, en
 * tests/unit/ui/dropdownMenu.test.tsx. Acá NO se re-verifica la lógica: se
 * verifica que el navegador haga lo que la lógica decide. Son dos capas y
 * ninguna reemplaza a la otra — un `Escape` que devuelve `focus: 'trigger'` en
 * una función pura y no mueve el foco en Chromium es exactamente el defecto
 * que este archivo existe para atrapar.
 *
 * ── POR QUÉ ESTE ARCHIVO NO NECESITA DATOS ─────────────────────────────────
 * Y es deliberado, no una casualidad. Staging fue reseteado y hay un re-test
 * esperando: sembrar una matrícula para poder probar un menú sería dejar basura
 * en el entorno que las testers van a usar. La barra se pinta ENTERAMENTE desde
 * la cookie `session-learner` —el layout la resuelve en el servidor y baja
 * `email` y `type`—, así que alcanza con firmar una cookie con el secreto local
 * y no se escribe ni una fila. El catálogo se lee, no se muta.
 *
 * A diferencia de scorm-player-premise.spec.ts, entonces, ESTE archivo no
 * depende del contenido del deployment: sólo de que haya un servidor sirviendo
 * la app.
 *
 * ── LOCAL-ONLY, COMO SUS VECINOS ───────────────────────────────────────────
 * Necesita un servidor Next corriendo. CI no levanta uno, así que esta suite no
 * va a CI, igual que org-seats / org-packs / scorm-player-premise.
 *
 *   cd apps/academia
 *   npx playwright test tests/e2e/account-menu-a11y.spec.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { SignJWT } from 'jose';

function readEnvLocal(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  try {
    const raw = fs.readFileSync(path.resolve(__dirname, '../../.env.local'), 'utf8');
    const m = raw.match(new RegExp(`^${key}=(.*)$`, 'm'));
    return m ? m[1].trim() : undefined;
  } catch {
    return undefined;
  }
}

const LEARNER_SECRET = new TextEncoder().encode(
  readEnvLocal('LEARNER_JWT_SECRET') || 'fallback-learner-secret-for-development-only'
);

const EMAIL = 'nati@example.com';

/**
 * El origen REAL contra el que corre la suite. No se escribe `localhost:3000` a
 * mano: el harness del reproductor ya documenta que un servidor ajeno en el
 * 3000 despistó a dos agentes en esta rama, y a mí me pasó lo mismo — durante
 * esta tarea el 3000 estuvo servido por otra app que redirige todo a /login, y
 * las cookies puestas sobre ese origen viajaban a la app equivocada. Sale de
 * PLAYWRIGHT_BASE_URL, que es lo mismo que usa `baseURL`.
 */
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

/**
 * `learnerId` es un identificador cualquiera A PROPÓSITO: la barra no lo usa
 * —el layout recorta la sesión a `email` y `type` antes de bajarla— así que
 * ninguna de estas pruebas toca una fila de `lmsCustomers`. Si algún día la
 * barra necesitara el id, este test empezaría a fallar, que es lo correcto.
 */
async function signIn(
  page: Page,
  type: 'individual' | 'org_admin' | 'org_learner' = 'org_admin'
): Promise<void> {
  const cookie = await new SignJWT({
    learnerId: 'e2e-no-toca-la-base',
    email: EMAIL,
    type,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(LEARNER_SECRET);

  await page.context().addCookies([
    {
      name: 'session-learner',
      value: cookie,
      url: BASE,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

/**
 * Igual que `signIn`, pero con un `learnerId` CON FORMA de id de `lmsCustomers`.
 * Hace falta sólo donde la página consulta Convex con ese id: el validador
 * rechaza cualquier otra cosa y la página responde 500. El id no necesita
 * existir —la fila ausente es justamente el caso que se quiere medir— así que
 * tampoco escribe nada.
 */
async function signInWithRealShapedId(page: Page): Promise<void> {
  const cookie = await new SignJWT({
    learnerId: 'kx7dj2w9r63364f4b542vxnftx88zwgf',
    email: EMAIL,
    type: 'individual',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(LEARNER_SECRET);

  await page.context().addCookies([
    {
      name: 'session-learner',
      value: cookie,
      url: BASE,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

const trigger = (page: Page) => page.getByRole('button', { name: `Mi cuenta — ${EMAIL}` });

/**
 * Un disparador de menú DE LA APLICACIÓN, acotado a la barra.
 *
 * El `header` no es decoración del selector: `[aria-haspopup="menu"]` a secas
 * también encuentra el botón de las Dev Tools de Next.js. Vive en un
 * `<nextjs-portal>` con shadow DOM, aparece ~1s después de hidratar, y los
 * selectores CSS de Playwright ATRAVIESAN el shadow DOM por defecto. Sin acotar,
 * el test de "sin sesión no aparece ningún control de cuenta" falla contra el
 * overlay del servidor de desarrollo y parece un defecto del producto. Costó un
 * rato entenderlo; queda escrito para que no lo cueste dos veces.
 */
const APP_MENU_TRIGGER = (page: Page) => page.locator('header [aria-haspopup="menu"]');

/** Qué elemento tiene el foco, descrito de forma legible en un mensaje de error. */
const activeDescription = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return 'ninguno';
    return `${el.tagName.toLowerCase()}[role=${el.getAttribute('role') ?? '-'}] "${(
      el.textContent ?? ''
    ).trim().slice(0, 40)}"`;
  });

/** El grosor real del anillo de foco sobre el elemento enfocado, en px. */
const activeOutlineWidth = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return 0;
    const s = getComputedStyle(el);
    if (s.outlineStyle === 'none') return 0;
    return parseFloat(s.outlineWidth || '0');
  });

test.describe('AC 13 — la barra no parpadea: la sesión se resuelve en el servidor', () => {
  test('el disparador viene en el HTML servido, antes de que corra un solo script', async ({
    page,
  }) => {
    await signIn(page);
    const response = await page.goto('/cursos', { waitUntil: 'commit' });

    // La prueba más dura que hay para "no parpadea": el control ya está en el
    // cuerpo de la respuesta. Si la sesión se pidiera desde el cliente, acá no
    // habría nada y el menú aparecería después — que es el parpadeo.
    const html = await response!.text();
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain(`Mi cuenta — ${EMAIL}`);
  });

  test('sin sesión no aparece ningún control de cuenta, ni tarde ni temprano', async ({
    page,
  }) => {
    await page.goto('/cursos');
    await page.waitForLoadState('networkidle');
    // Si hubiera un fetch de sesión tardío, este es el margen donde se vería.
    await page.waitForTimeout(1_500);
    await expect(APP_MENU_TRIGGER(page)).toHaveCount(0);
    await expect(page.getByText('Cerrar sesión')).toHaveCount(0);
  });

  test('el disparador ya está en el DOM al terminar de parsear, sin esperar a hidratar', async ({
    page,
  }) => {
    await signIn(page);
    await page.goto('/cursos', { waitUntil: 'domcontentloaded' });
    expect(await APP_MENU_TRIGGER(page).count()).toBe(1);
  });
});

test.describe('AC 9 — el menú se opera SÓLO con teclado', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto('/cursos');
    await expect(trigger(page)).toBeVisible();
  });

  test('se llega al disparador tabulando, sin puntero', async ({ page }) => {
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    let llegó = false;
    for (let i = 0; i < 25 && !llegó; i++) {
      await page.keyboard.press('Tab');
      llegó = await trigger(page).evaluate((el) => el === document.activeElement);
    }
    expect(llegó, `no se llegó al disparador tabulando; foco en ${await activeDescription(page)}`)
      .toBe(true);
  });

  test('ArrowDown abre y EL FOCO ENTRA AL MENÚ (no se queda en el disparador)', async ({
    page,
  }) => {
    await trigger(page).focus();
    await page.keyboard.press('ArrowDown');

    await expect(page.getByRole('menu')).toBeVisible();
    await expect(trigger(page)).toHaveAttribute('aria-expanded', 'true');

    // La falla clásica: el menú se abre y el foco se queda afuera.
    const rol = await page.evaluate(() => document.activeElement?.getAttribute('role'));
    expect(rol, `foco en ${await activeDescription(page)}`).toBe('menuitem');
    await expect(page.locator(':focus')).toHaveText('Mis cursos');
  });

  test('Enter y la barra espaciadora también abren, y también meten el foco', async ({
    page,
  }) => {
    for (const key of ['Enter', ' ']) {
      await trigger(page).focus();
      await page.keyboard.press(key);
      await expect(page.getByRole('menu')).toBeVisible();
      expect(
        await page.evaluate(() => document.activeElement?.getAttribute('role')),
        `con ${key}`
      ).toBe('menuitem');
      await page.keyboard.press('Escape');
    }
  });

  test('ArrowUp abre por el final', async ({ page }) => {
    await trigger(page).focus();
    await page.keyboard.press('ArrowUp');
    await expect(page.locator(':focus')).toHaveText('Cerrar sesión');
  });

  test('las flechas recorren el menú y dan la vuelta', async ({ page }) => {
    await trigger(page).focus();
    await page.keyboard.press('ArrowDown');

    // org_admin: Mis cursos, Mi cuenta, Privacidad, Mi empresa, Cerrar sesión.
    const orden = ['Mis cursos', 'Mi cuenta', 'Privacidad', 'Mi empresa', 'Cerrar sesión'];
    for (const esperado of orden) {
      await expect(page.locator(':focus')).toHaveText(esperado);
      await page.keyboard.press('ArrowDown');
    }
    // Y vuelve al principio.
    await expect(page.locator(':focus')).toHaveText('Mis cursos');

    await page.keyboard.press('ArrowUp');
    await expect(page.locator(':focus')).toHaveText('Cerrar sesión');
  });

  test('Home y End van al primero y al último', async ({ page }) => {
    await trigger(page).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('End');
    await expect(page.locator(':focus')).toHaveText('Cerrar sesión');
    await page.keyboard.press('Home');
    await expect(page.locator(':focus')).toHaveText('Mis cursos');
  });

  test('ESCAPE CIERRA Y DEVUELVE EL FOCO AL DISPARADOR', async ({ page }) => {
    await trigger(page).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator(':focus')).toHaveText('Mi cuenta');

    await page.keyboard.press('Escape');

    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(trigger(page)).toHaveAttribute('aria-expanded', 'false');
    const volvió = await trigger(page).evaluate((el) => el === document.activeElement);
    expect(volvió, `el foco quedó en ${await activeDescription(page)}`).toBe(true);
  });

  test('Tab no atrapa: cierra el menú y la tabulación sigue afuera', async ({ page }) => {
    await trigger(page).focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menu')).toBeVisible();

    await page.keyboard.press('Tab');

    await expect(page.getByRole('menu')).toHaveCount(0);
    const dentro = await page.evaluate(
      () => document.activeElement?.getAttribute('role') === 'menuitem'
    );
    expect(dentro).toBe(false);
  });

  test('EL FOCO SE VE: hay anillo en el disparador y en cada ítem del menú', async ({
    page,
  }) => {
    // El testing de Zephyra levantó foco que existe y no se ve, y por eso este
    // criterio es bloqueante. Se mide el estilo COMPUTADO, no lo declarado.
    await trigger(page).focus();
    expect(await activeOutlineWidth(page), 'el disparador no muestra anillo').toBeGreaterThan(0);

    await page.keyboard.press('ArrowDown');
    for (let i = 0; i < 5; i++) {
      const ancho = await activeOutlineWidth(page);
      expect(ancho, `sin anillo en ${await activeDescription(page)}`).toBeGreaterThan(0);
      await page.keyboard.press('ArrowDown');
    }
  });

  test('el disparador anuncia el menú y su estado', async ({ page }) => {
    const t = trigger(page);
    await expect(t).toHaveAttribute('aria-haspopup', 'menu');
    await expect(t).toHaveAttribute('aria-expanded', 'false');
    await t.focus();
    await page.keyboard.press('ArrowDown');
    await expect(t).toHaveAttribute('aria-expanded', 'true');
    // El panel se nombra desde el disparador, así que un lector anuncia de
    // quién es el menú y no sólo "menú".
    const labelledBy = await page.getByRole('menu').getAttribute('aria-labelledby');
    expect(labelledBy).toBe(await t.getAttribute('id'));
  });

  test('la identidad se lee pero no recibe foco', async ({ page }) => {
    await trigger(page).focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menu')).toContainText(EMAIL);
    // Recorrer el menú entero nunca aterriza en el correo.
    for (let i = 0; i < 6; i++) {
      await expect(page.locator(':focus')).not.toHaveText(EMAIL);
      await page.keyboard.press('ArrowDown');
    }
  });
});

test.describe('AC 8 en un navegador — «Mi empresa» sólo para la dueña', () => {
  for (const type of ['individual', 'org_learner'] as const) {
    test(`no aparece para ${type}`, async ({ page }) => {
      await signIn(page, type);
      await page.goto('/cursos');
      await trigger(page).focus();
      await page.keyboard.press('ArrowDown');
      await expect(page.getByRole('menu')).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Mi empresa' })).toHaveCount(0);
    });
  }

  test('aparece para org_admin', async ({ page }) => {
    await signIn(page, 'org_admin');
    await page.goto('/cursos');
    await trigger(page).focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Mi empresa' })).toHaveCount(1);
  });
});

test.describe('AC 10 — teléfono', () => {
  // Viewport de un iPhone 12/13/14 en CSS px. NO emula el chrome del navegador
  // de iOS: ver la nota al pie de este describe.
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('el área de cuenta se alcanza DENTRO del menú móvil', async ({ page }) => {
    await signIn(page, 'org_admin');
    await page.goto('/cursos');

    // El desplegable de escritorio no está: en teléfono se oculta para no
    // duplicar el acceso.
    await expect(trigger(page)).toBeHidden();

    await page.getByRole('button', { name: 'Abrir menu' }).click();

    for (const label of ['Mis cursos', 'Mi cuenta', 'Privacidad', 'Mi empresa']) {
      await expect(page.getByRole('link', { name: label })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
    await expect(page.getByText(EMAIL)).toBeVisible();
  });

  test('los blancos táctiles MIDEN 44px, no sólo lo declaran', async ({ page }) => {
    await signIn(page, 'org_admin');
    await page.goto('/cursos');
    await page.getByRole('button', { name: 'Abrir menu' }).click();

    const objetivos = [
      page.getByRole('link', { name: 'Mis cursos' }),
      page.getByRole('link', { name: 'Mi cuenta' }),
      page.getByRole('link', { name: 'Privacidad' }),
      page.getByRole('link', { name: 'Mi empresa' }),
      page.getByRole('button', { name: 'Cerrar sesión' }),
    ];

    for (const objetivo of objetivos) {
      const caja = await objetivo.boundingBox();
      const nombre = (await objetivo.textContent())?.trim();
      expect(caja, `sin caja: ${nombre}`).not.toBeNull();
      expect(caja!.height, `alto de "${nombre}"`).toBeGreaterThanOrEqual(44);
    }
  });

  test('ningún blanco del área de cuenta queda debajo del mínimo en /cursos/mis-cursos', async ({
    page,
  }) => {
    await signIn(page, 'individual');
    // Sin matrículas: es el estado vacío, que también tiene un blanco táctil.
    const respuesta = await page.goto('/cursos/mis-cursos');
    test.skip(
      respuesta !== null && respuesta.status() >= 500,
      'la query de la pantalla no está desplegada en este deployment'
    );
    const salida = page.getByRole('link', { name: 'Ver el catálogo' });
    if (await salida.count()) {
      const caja = await salida.boundingBox();
      expect(caja!.height).toBeGreaterThanOrEqual(44);
    }
  });
});

/**
 * DEFECTO E — medición, no arreglo.
 *
 * El reproductor es una superficie a pantalla completa, pero la ruta vive en el
 * grupo (public), así que el layout público SIGUE montando la barra debajo del
 * contenedor fijo del player. La barra queda tapada por pintura (el shell usa
 * un z-index mayor), no removida del documento: sus enlaces siguen en el árbol
 * y siguen siendo tabulables.
 *
 * Esto NO lo introduce el menú de cuenta —los enlaces institucionales y el
 * hamburguesa ya estaban ahí— y el arreglo no es de este paquete. Lo que sigue
 * MIDE el tamaño real del problema para que la decisión se tome con un número.
 */
test.describe('Defecto E — el cromo tapado detrás del reproductor (evidencia)', () => {
  const SLUG =
    process.env.SCORM_E2E_SLUG ??
    'diversidad-equidad-e-inclusion-en-el-trabajo-como-construir-entornos-laborales-r-lusion';

  test('la barra sigue en el documento, y su foco es alcanzable, detrás del reproductor', async ({
    page,
  }) => {
    // Acá SÍ hace falta un learnerId con forma de id de Convex: la página del
    // reproductor consulta la matrícula y el validador rechaza cualquier otra
    // cosa con un 500. El id NO tiene que existir —sin matrícula se pinta la
    // pantalla de "no tenés acceso", que es la que se quiere medir— así que
    // sigue sin tocarse ninguna fila.
    await signInWithRealShapedId(page);
    await page.goto(`/cursos/${SLUG}/player`, { waitUntil: 'domcontentloaded' });

    // La barra está montada aunque no se vea.
    const barra = page.locator('header');
    expect(await barra.count(), 'la barra debería seguir montada bajo el player').toBeGreaterThan(0);

    // Cuántos controles del cromo tapado se pueden alcanzar tabulando desde el
    // principio del documento. Cero sería "el defecto no existe".
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    const alcanzados: string[] = [];
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return null;
        const header = el.closest('header');
        if (!header) return null;
        return (el.textContent ?? el.getAttribute('aria-label') ?? '?').trim().slice(0, 40);
      });
      if (info) alcanzados.push(info);
    }

    // Se REGISTRA, no se exige. Este test es evidencia para el paquete
    // siguiente: si alguien arregla el defecto, el arreglo no lo pone en rojo.
    console.log(
      `[defecto E] controles del cromo tapado alcanzables con Tab: ${alcanzados.length}` +
        (alcanzados.length ? ` -> ${JSON.stringify(alcanzados)}` : '')
    );
    expect(Array.isArray(alcanzados)).toBe(true);
  });
});
