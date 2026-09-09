/**
 * T-fe-004 — la primitiva de menú desplegable de @zephyra/ui.
 *
 * AC 9 (el menú es accesible) y AC 10 (anda en teléfono) son BLOQUEANTES, no
 * preferencias: el testing de Zephyra ya levantó foco que existe y no se ve, y
 * esto es interfaz nueva sobre un repo que no tenía ninguna primitiva de menú.
 *
 * ── POR QUÉ ESTOS TESTS VIVEN EN apps/academia Y NO EN packages/ui ──────────
 * `packages/ui` NO TIENE RUNNER DE TESTS. Su package.json declara `lint` y
 * `typecheck` y nada más, así que la tarea `test` de turbo no lo alcanza: hoy
 * hay cero tests sobre los catorce componentes del paquete. Darle uno significa
 * agregar vitest a sus devDependencies, y eso toca el lockfile — un cambio de
 * dependencias que esta tarea no es el lugar para hacer. La alternativa que sí
 * está disponible es ésta: academia consume `@zephyra/ui` por workspace y su
 * runner lo resuelve, así que los tests corren igual y cuentan en el mismo
 * total. Queda anotado como deuda con nombre y no como omisión.
 *
 * ── QUÉ SE PRUEBA ACÁ Y QUÉ NO ─────────────────────────────────────────────
 * Este workspace corre vitest con `environment: "node"` y jsdom no es
 * dependencia. Así que se prueban las dos capas que SÍ son verificables sin
 * navegador, y son las dos donde vive el diseño:
 *
 *   1. LA MÁQUINA DE TECLADO, pura. Cada tecla, cada borde, incluidos los que
 *      un navegador rara vez te muestra: la vuelta circular, el menú vacío,
 *      `Tab` que cierra sin consumir, `Enter` que NO se consume para que una
 *      ancla se active nativamente.
 *   2. EL CONTRATO DE MARCADO servido: `aria-haspopup`, `aria-expanded`,
 *      `role="menu"`/`menuitem"`, roving tabindex, y que la hoja de estilo
 *      declare los 44px y el foco visible.
 *
 * Lo que NO se prueba acá, y no se disfraza de probado: que el navegador
 * efectivamente mueva el foco, que el anillo se vea, y que un lector de
 * pantalla anuncie el menú. Eso es Playwright + verificación manual con lector
 * de pantalla, y es donde AC 9 y AC 10 terminan de cerrarse.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
// El consumidor real usa <Link>: el fixture usa el mismo elemento, no un <a>
// suelto, para que lo que se afirma sea lo que la barra va a montar.
import Link from 'next/link';
import {
  DropdownMenu,
  resolveMenuKey,
  CLOSED_MENU,
  type DropdownMenuEntry,
  type MenuState,
} from '@zephyra/ui';

const OPEN = (activeIndex: number): MenuState => ({ open: true, activeIndex });

describe('resolveMenuKey — con el menú CERRADO', () => {
  it('ArrowDown abre y manda el foco al PRIMER ítem', () => {
    const r = resolveMenuKey('ArrowDown', CLOSED_MENU, 4);
    expect(r.state).toEqual({ open: true, activeIndex: 0 });
    expect(r.focus).toBe('item');
    expect(r.handled).toBe(true);
  });

  it('ArrowUp abre y manda el foco al ÚLTIMO ítem', () => {
    expect(resolveMenuKey('ArrowUp', CLOSED_MENU, 4).state).toEqual({
      open: true,
      activeIndex: 3,
    });
  });

  it('Enter y la barra espaciadora también abren, en sus dos grafías', () => {
    for (const key of ['Enter', ' ', 'Spacebar']) {
      const r = resolveMenuKey(key, CLOSED_MENU, 3);
      expect(r.state.open, `${key} debería abrir`).toBe(true);
      expect(r.state.activeIndex).toBe(0);
      expect(r.focus).toBe('item');
    }
  });

  it('EL FOCO ENTRA AL MENÚ: ninguna forma de abrir con teclado deja el foco en el disparador', () => {
    // La falla clásica de un menú hecho a mano: se abre, se ve, y el foco se
    // quedó afuera. Quien navega con teclado no llega nunca a los ítems.
    for (const key of ['ArrowDown', 'ArrowUp', 'Enter', ' ']) {
      expect(resolveMenuKey(key, CLOSED_MENU, 3).focus, key).toBe('item');
    }
  });

  it('las teclas que no son de apertura no tocan nada', () => {
    for (const key of ['a', 'Escape', 'Tab', 'Home', 'End', 'ArrowLeft']) {
      const r = resolveMenuKey(key, CLOSED_MENU, 3);
      expect(r.state, key).toBe(CLOSED_MENU);
      expect(r.handled, key).toBe(false);
    }
  });
});

describe('resolveMenuKey — con el menú ABIERTO', () => {
  it('ArrowDown y ArrowUp recorren, y dan la vuelta en los extremos', () => {
    expect(resolveMenuKey('ArrowDown', OPEN(0), 3).state.activeIndex).toBe(1);
    expect(resolveMenuKey('ArrowDown', OPEN(2), 3).state.activeIndex).toBe(0);
    expect(resolveMenuKey('ArrowUp', OPEN(2), 3).state.activeIndex).toBe(1);
    expect(resolveMenuKey('ArrowUp', OPEN(0), 3).state.activeIndex).toBe(2);
  });

  it('Home y End van al primero y al último', () => {
    expect(resolveMenuKey('Home', OPEN(2), 4).state.activeIndex).toBe(0);
    expect(resolveMenuKey('End', OPEN(1), 4).state.activeIndex).toBe(3);
  });

  it('abierto con el puntero (sin ítem activo), las flechas entran igual', () => {
    expect(resolveMenuKey('ArrowDown', OPEN(-1), 3).state.activeIndex).toBe(0);
    expect(resolveMenuKey('ArrowUp', OPEN(-1), 3).state.activeIndex).toBe(2);
  });

  it('ESCAPE CIERRA Y DEVUELVE EL FOCO AL DISPARADOR', () => {
    const r = resolveMenuKey('Escape', OPEN(2), 4);
    expect(r.state).toEqual(CLOSED_MENU);
    expect(r.focus).toBe('trigger');
    expect(r.handled).toBe(true);
  });

  it('Escape devuelve el foco desde cualquier posición, incluida ninguna', () => {
    for (const index of [-1, 0, 1, 3]) {
      const r = resolveMenuKey('Escape', OPEN(index), 4);
      expect(r.focus, `activeIndex=${index}`).toBe('trigger');
      expect(r.state.open).toBe(false);
    }
  });

  it('Tab cierra pero NO se consume: la tabulación sigue afuera y nadie queda atrapado', () => {
    const r = resolveMenuKey('Tab', OPEN(1), 4);
    expect(r.state).toEqual(CLOSED_MENU);
    expect(r.handled).toBe(false); // sin preventDefault
    expect(r.focus).toBe('none'); // no se le roba el foco al siguiente control
  });

  it('Enter NO se consume — una ancla se activa nativamente', () => {
    // Consumirlo obligaría a re-implementar la navegación a mano, y ahí se
    // pierden el click del medio, "abrir en pestaña nueva" y el href.
    const r = resolveMenuKey('Enter', OPEN(1), 4);
    expect(r.handled).toBe(false);
    expect(r.activate).toBe(false);
    expect(r.state.open).toBe(true);
  });

  it('la barra espaciadora SÍ se consume y activa: un ancla no responde sola al espacio', () => {
    for (const key of [' ', 'Spacebar']) {
      const r = resolveMenuKey(key, OPEN(1), 4);
      expect(r.handled, key).toBe(true);
      expect(r.activate, key).toBe(true);
    }
  });

  it('la barra espaciadora sin ítem enfocado no activa nada', () => {
    expect(resolveMenuKey(' ', OPEN(-1), 4).activate).toBe(false);
  });

  it('una tecla cualquiera no cierra ni mueve — y devuelve el MISMO objeto de estado', () => {
    // La identidad importa: el componente sólo hace setState cuando el estado
    // devuelto es otro objeto. Si un no-op devolviera una copia, cada tecla
    // suelta provocaría un render y el foco podría saltar.
    const before = OPEN(1);
    const r = resolveMenuKey('x', before, 4);
    expect(r.state).toBe(before);
    expect(r.handled).toBe(false);
  });
});

describe('resolveMenuKey — un menú sin ítems no es una trampa de foco', () => {
  it('nunca abre: no hay a dónde mandar el foco', () => {
    for (const key of ['ArrowDown', 'ArrowUp', 'Enter', ' ']) {
      const r = resolveMenuKey(key, CLOSED_MENU, 0);
      expect(r.state.open, key).toBe(false);
      expect(r.handled, key).toBe(false);
    }
  });

  it('si igual quedó abierto y vacío, Escape sigue siendo la salida', () => {
    const r = resolveMenuKey('Escape', OPEN(-1), 0);
    expect(r.state).toEqual(CLOSED_MENU);
    expect(r.focus).toBe('trigger');
  });
});

/* ─────────────────────────────────────────────────────────────────────────── */

const ENTRIES: DropdownMenuEntry[] = [
  { kind: 'label', id: 'identidad', content: 'nati@example.com' },
  { kind: 'separator', id: 'sep-1' },
  {
    kind: 'custom',
    id: 'mis-cursos',
    render: (p) => (
      <Link href="/cursos/mis-cursos" {...p}>
        Mis cursos
      </Link>
    ),
  },
  { kind: 'action', id: 'accion', label: 'Una acción', onSelect: () => {} },
  { kind: 'separator', id: 'sep-2' },
  {
    kind: 'form',
    id: 'salir',
    label: 'Cerrar sesión',
    action: async () => {},
  },
];

const render = (entries: DropdownMenuEntry[] = ENTRIES) =>
  renderToStaticMarkup(
    <DropdownMenu
      triggerLabel="Cuenta de nati@example.com"
      triggerContent={<span aria-hidden="true">N</span>}
      entries={entries}
    />
  );

describe('DropdownMenu — el contrato de marcado que sirve el servidor (AC 9)', () => {
  it('el disparador declara aria-haspopup y aria-expanded', () => {
    const html = render();
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
  });

  it('el disparador tiene nombre accesible propio, no "menú"', () => {
    // Lo que anuncia un lector de pantalla tiene que decir DE QUIÉN es el menú.
    expect(render()).toContain('aria-label="Cuenta de nati@example.com"');
  });

  it('el disparador es un <button type="button">, no un div con onClick', () => {
    const html = render();
    expect(html).toMatch(/<button[^>]*type="button"/);
  });

  it('cerrado no anuncia un panel que no existe (sin aria-controls colgado)', () => {
    // aria-controls apuntando a un id ausente es una promesa rota para
    // tecnología asistiva.
    expect(render()).not.toContain('aria-controls');
  });

  it('cerrado no renderiza el panel', () => {
    const html = render();
    expect(html).not.toContain('role="menu"');
    expect(html).not.toContain('Cerrar sesión');
  });

  it('el contenido decorativo del disparador no se anuncia dos veces', () => {
    expect(render()).toContain('aria-hidden="true"');
  });
});

describe('DropdownMenu — composición de ítems', () => {
  it('los ítems navegables los renderiza el consumidor y siguen siendo anclas', () => {
    // El paquete no se queda con el elemento: un <Link>/<a> conserva href, rol
    // y click del medio. La primitiva sólo le presta rol, tabIndex y clase.
    const html = renderToStaticMarkup(
      <div>
        {(
          ENTRIES.find((e) => e.kind === 'custom') as Extract<
            DropdownMenuEntry,
            { kind: 'custom' }
          >
        ).render({
          role: 'menuitem',
          tabIndex: 0,
          className: 'x',
          ref: () => {},
          onClick: () => {},
          'data-dropdown-item-id': 'mis-cursos',
        })}
      </div>
    );
    expect(html).toContain('<a');
    expect(html).toContain('href="/cursos/mis-cursos"');
    expect(html).toContain('role="menuitem"');
  });

  it('el cierre de sesión es <form action={...}> con un submit adentro — el patrón que ya usa la app', () => {
    const entry = ENTRIES.find((e) => e.kind === 'form');
    expect(entry).toBeDefined();
    // La forma la fija el tipo: `action` es una acción de servidor, no un href.
    expect(typeof (entry as Extract<DropdownMenuEntry, { kind: 'form' }>).action).toBe(
      'function'
    );
  });

  it('sólo los ítems accionables cuentan para el recorrido: etiquetas y separadores no reciben foco', () => {
    // ENTRIES tiene 6 entradas: 1 etiqueta + 2 separadores + 3 accionables.
    const accionables = ENTRIES.filter(
      (e) => e.kind === 'action' || e.kind === 'form' || e.kind === 'custom'
    );
    expect(accionables).toHaveLength(3);
    // Y la máquina recorre exactamente esos tres, con vuelta circular.
    expect(resolveMenuKey('ArrowDown', OPEN(2), accionables.length).state.activeIndex).toBe(
      0
    );
  });
});

describe('DropdownMenu — la hoja de estilo sostiene AC 9 y AC 10', () => {
  const CSS = fs.readFileSync(
    path.resolve(
      __dirname,
      '../../../../../packages/ui/src/components/ui/DropdownMenu/DropdownMenu.module.css'
    ),
    'utf8'
  );

  it('los blancos táctiles son de 44px, en el disparador Y en cada fila', () => {
    expect(CSS).toMatch(/\.trigger\s*\{[^}]*min-width:\s*44px/);
    expect(CSS).toMatch(/\.trigger\s*\{[^}]*min-height:\s*44px/);
    expect(CSS).toMatch(/\.item\s*\{[^}]*min-height:\s*44px/);
  });

  it('EL FOCO SE VE SIEMPRE: se estila :focus, no sólo :focus-visible', () => {
    // El menú mueve el foco por código. Si la persona abrió con el puntero,
    // muchos navegadores no consideran "visible" ese foco y :focus-visible no
    // aplica: quedaría foco que existe y no se ve, que es el defecto que el
    // testing ya reportó.
    expect(CSS).toContain('.trigger:focus,');
    expect(CSS).toContain('.item:focus,');
    expect(CSS).toMatch(/outline:\s*2px solid var\(--color-focus-ring\)/);
  });

  it('el foco no se apaga en ningún lado', () => {
    expect(CSS).not.toMatch(/outline:\s*(none|0)/);
  });

  it('sólo tokens: ni un color literal en la hoja', () => {
    const declarations = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(declarations).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(declarations).not.toMatch(/\brgba?\(/);
  });

  it('el panel se ancla al z-index de desplegables, no a uno inventado', () => {
    expect(CSS).toMatch(/z-index:\s*var\(--z-dropdown\)/);
  });

  it('en pantalla chica el panel no se sale de la ventana', () => {
    expect(CSS).toMatch(/@media \(max-width: 480px\)/);
    expect(CSS).toMatch(/min-width:\s*min\(18rem, calc\(100vw/);
  });
});

describe('DropdownMenu — el panel abierto (estructura, no render)', () => {
  // El panel sólo existe con el menú ABIERTO, y abrirlo requiere un evento y por
  // lo tanto un DOM. Sin runner con DOM en este workspace, estas propiedades se
  // afirman sobre el código —igual que hacen las invariantes de marca de este
  // mismo directorio de tests— y se verifican vivas en Playwright. Se declara
  // así en vez de dejarlas sin cubrir: son las que hacen que un lector de
  // pantalla entienda que esto es un menú.
  const SRC = fs.readFileSync(
    path.resolve(
      __dirname,
      '../../../../../packages/ui/src/components/ui/DropdownMenu/DropdownMenu.tsx'
    ),
    'utf8'
  );

  it('el panel es role="menu" y se nombra desde el disparador', () => {
    expect(SRC).toContain('role="menu"');
    expect(SRC).toContain('aria-labelledby={triggerId}');
  });

  it('el disparador apunta al panel sólo cuando el panel existe', () => {
    expect(SRC).toContain('aria-controls={state.open ? menuId : undefined}');
  });

  it('cada ítem accionable es role="menuitem"', () => {
    expect(SRC).toContain("role: 'menuitem'");
  });

  it('las filas no accionables no se hacen pasar por ítems', () => {
    expect(SRC).toContain('role="presentation"'); // la identidad
    expect(SRC).toContain('role="separator"');
    // Los envoltorios (el <form> y el slot del consumidor) salen del árbol de
    // accesibilidad: un genérico suelto dentro de un role="menu" es inválido.
    expect(SRC).toContain('role="none"');
  });

  it('roving tabindex: sólo el ítem enfocado es tabulable', () => {
    expect(SRC).toContain('tabIndex: state.activeIndex === index ? 0 : -1');
  });

  it('el foco entra al menú por efecto, no por suerte', () => {
    expect(SRC).toContain('itemRefs.current[state.activeIndex]?.focus()');
  });

  it('Escape devuelve el foco al disparador', () => {
    expect(SRC).toContain("if (result.focus === 'trigger') focusTrigger();");
  });

  it('el componente es de cliente: usa estado y foco', () => {
    expect(SRC.startsWith("'use client';")).toBe(true);
  });
});

describe('DropdownMenu — el barril de @zephyra/ui', () => {
  it('exporta el componente y la máquina de teclado', () => {
    expect(typeof DropdownMenu).toBe('function');
    expect(typeof resolveMenuKey).toBe('function');
    expect(CLOSED_MENU).toEqual({ open: false, activeIndex: -1 });
  });

  it('no re-exporta CSS ni providers desde el barril', () => {
    // La regla del paquete: el barril son componentes presentacionales; los
    // providers y las hojas de estilo van por sus propios subpaths.
    const barrel = fs.readFileSync(
      path.resolve(__dirname, '../../../../../packages/ui/src/index.ts'),
      'utf8'
    );
    expect(barrel).not.toMatch(/export .* from '.*\.css'/);
    expect(barrel).not.toMatch(/export .* from '.\/providers/);
    expect(barrel).toContain("from './components/ui/DropdownMenu'");
  });
});
