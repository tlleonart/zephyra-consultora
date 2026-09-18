'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '@zephyra/utils';
import {
  CLOSED_MENU,
  resolveMenuKey,
  type MenuState,
} from './menuKeyboard';
import styles from './DropdownMenu.module.css';

/**
 * Menú desplegable accesible. No existía primitiva de menú en el paquete: hay
 * Button, Card, Input, Modal/ConfirmDialog, Select, Table, Toast, IconPicker,
 * ImageUpload, Skeleton, ClientOnly y ErrorBoundary, y ninguna es un menú.
 *
 * LO QUE ESTA PRIMITIVA GARANTIZA, y es la razón de que sea una primitiva y no
 * markup suelto en una barra:
 *
 *   - se abre y se opera SÓLO con teclado (flechas, Home, End, Escape);
 *   - el disparador declara `aria-haspopup` y `aria-expanded`;
 *   - al abrirse el foco ENTRA al menú, y no se queda en el disparador;
 *   - `Escape` cierra y DEVUELVE el foco al disparador;
 *   - el foco es visible siempre, incluso cuando se movió por código;
 *   - los blancos táctiles son de 44px.
 *
 * Las decisiones de teclado no viven acá: viven en `menuKeyboard.ts`, puras y
 * probadas tecla por tecla sin DOM. Este archivo aplica la intención.
 *
 * POR QUÉ LOS ÍTEMS NAVEGABLES LOS RENDERIZA EL CONSUMIDOR (`kind: 'custom'`).
 * Este paquete no tiene ni un ancla ni un `next/link` — es una propiedad
 * declarada por escrito en su configuración de lint. Y ya existe el precedente:
 * `btnClass` exporta el aspecto del botón como cadena de clases justamente para
 * que un `<Link>` o un `<a>` de cualquier app se vista igual sin que el paquete
 * se quede con el elemento, y sin que las anclas terminen reescritas como
 * botones —que es como se pierden `href`, el click del medio y el rol correcto
 * para tecnología asistiva. Un menú de cuenta es, sobre todo, navegación: la
 * misma regla aplica más fuerte. El menú entrega las props (rol, tabIndex, ref,
 * clase, cierre al activar) y el consumidor elige el elemento.
 *
 * Los ítems que SÍ renderiza la primitiva son los que no son navegación: un
 * botón con `onSelect` y un `<form action={...}>` para una acción de servidor,
 * porque en los dos casos el elemento correcto es un `<button>` y no hay nada
 * que el consumidor pueda elegir mejor.
 */

/** Las props que el menú le pone a cada ítem interactivo. */
export interface DropdownMenuItemRenderProps {
  role: 'menuitem';
  /** Roving tabindex: sólo el ítem enfocado es tabulable. */
  tabIndex: 0 | -1;
  className: string;
  ref: (node: HTMLElement | null) => void;
  /** Cierra el menú. Se dispara también cuando el navegador activa con Enter. */
  onClick: () => void;
  'data-dropdown-item-id': string;
}

export type DropdownMenuEntry =
  /** Identidad u encabezado: se lee, no se acciona, y no recibe foco. */
  | { kind: 'label'; id: string; content: ReactNode }
  /** Separador visual y semántico entre grupos. */
  | { kind: 'separator'; id: string }
  /** Botón con una acción de cliente. */
  | { kind: 'action'; id: string; label: ReactNode; onSelect: () => void }
  /**
   * `<form action={serverAction}>` con un `<button type="submit">` adentro — el
   * mismo patrón que ya usa el cierre de sesión de la superficie de empresa. Se
   * espeja, no se inventa uno nuevo.
   */
  | {
      kind: 'form';
      id: string;
      label: ReactNode;
      action: (formData: FormData) => void | Promise<void>;
    }
  /** Cualquier otro elemento — típicamente un `<Link>`. Ver el docblock. */
  | {
      kind: 'custom';
      id: string;
      render: (props: DropdownMenuItemRenderProps) => ReactNode;
    };

export interface DropdownMenuProps {
  /**
   * El nombre accesible del disparador. Es lo que anuncia un lector de
   * pantalla, así que tiene que decir de quién es el menú (por ejemplo el
   * correo de la alumna), no "menú".
   */
  triggerLabel: string;
  /** El contenido VISIBLE del disparador (una inicial, un ícono, un avatar). */
  triggerContent: ReactNode;
  entries: DropdownMenuEntry[];
  /** De qué lado del disparador se alinea el panel. Por defecto `end`. */
  align?: 'start' | 'end';
  /** Se avisa al abrir y al cerrar (útil para cerrar un menú móvil que lo contenga). */
  onOpenChange?: (open: boolean) => void;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
}

const isInteractive = (entry: DropdownMenuEntry): boolean =>
  entry.kind === 'action' || entry.kind === 'form' || entry.kind === 'custom';

export const DropdownMenu = ({
  triggerLabel,
  triggerContent,
  entries,
  align = 'end',
  onOpenChange,
  className,
  triggerClassName,
  menuClassName,
}: DropdownMenuProps) => {
  const reactId = useId();
  const triggerId = `dropdown-trigger-${reactId}`;
  const menuId = `dropdown-menu-${reactId}`;

  const [state, setState] = useState<MenuState>(CLOSED_MENU);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  /** Sólo los ítems accionables cuentan para el recorrido con flechas. */
  const itemCount = entries.filter(isInteractive).length;

  const focusTrigger = useCallback(() => {
    triggerRef.current?.focus();
  }, []);

  const setOpen = useCallback((next: MenuState) => setState(next), []);

  /**
   * El aviso al consumidor sale de un EFECTO, no de adentro del updater de
   * `setState`. Un updater tiene que ser puro: React puede llamarlo dos veces
   * en modo estricto, y ahí `onOpenChange` se dispararía duplicado — que en una
   * barra significa, por ejemplo, cerrar el menú móvil dos veces. El ref evita
   * repetir el aviso cuando el efecto vuelve a correr sin que el estado abierto
   * haya cambiado.
   */
  const announcedOpenRef = useRef(false);
  useEffect(() => {
    if (announcedOpenRef.current === state.open) return;
    announcedOpenRef.current = state.open;
    onOpenChange?.(state.open);
  }, [state.open, onOpenChange]);

  const close = useCallback(() => setOpen(CLOSED_MENU), [setOpen]);

  /**
   * El foco ENTRA al menú. Sin esto el menú se abre y el foco se queda en el
   * disparador, que es la falla clásica: se ve abierto y no se puede recorrer.
   */
  useEffect(() => {
    if (!state.open || state.activeIndex < 0) return;
    itemRefs.current[state.activeIndex]?.focus();
  }, [state.open, state.activeIndex]);

  /** Un click afuera cierra, SIN robar el foco: la persona ya eligió otra cosa. */
  useEffect(() => {
    if (!state.open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [state.open, close]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const result = resolveMenuKey(event.key, state, itemCount);

    if (result.activate) {
      itemRefs.current[state.activeIndex]?.click();
    }
    if (result.handled) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (result.state !== state) setOpen(result.state);
    if (result.focus === 'trigger') focusTrigger();
  };

  const registerItem =
    (index: number) =>
    (node: HTMLElement | null): void => {
      itemRefs.current[index] = node;
    };

  const itemProps = (
    index: number,
    id: string
  ): DropdownMenuItemRenderProps => ({
    role: 'menuitem',
    tabIndex: state.activeIndex === index ? 0 : -1,
    className: styles.item,
    ref: registerItem(index),
    onClick: close,
    'data-dropdown-item-id': id,
  });

  let interactiveIndex = -1;

  return (
    <div ref={rootRef} className={cn(styles.root, className)}>
      <button
        type="button"
        ref={triggerRef}
        id={triggerId}
        className={cn(styles.trigger, triggerClassName)}
        aria-haspopup="menu"
        aria-expanded={state.open}
        aria-controls={state.open ? menuId : undefined}
        aria-label={triggerLabel}
        onClick={() =>
          setOpen(state.open ? CLOSED_MENU : { open: true, activeIndex: -1 })
        }
        onKeyDown={handleKeyDown}
      >
        {triggerContent}
      </button>

      {state.open ? (
        <div
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          className={cn(styles.menu, styles[align], menuClassName)}
          onKeyDown={handleKeyDown}
        >
          {entries.map((entry) => {
            if (entry.kind === 'label') {
              return (
                <div key={entry.id} role="presentation" className={styles.label}>
                  {entry.content}
                </div>
              );
            }
            if (entry.kind === 'separator') {
              return (
                <div key={entry.id} role="separator" className={styles.separator} />
              );
            }

            interactiveIndex += 1;
            const props = itemProps(interactiveIndex, entry.id);

            if (entry.kind === 'custom') {
              return (
                <div key={entry.id} role="none" className={styles.itemSlot}>
                  {entry.render(props)}
                </div>
              );
            }

            if (entry.kind === 'action') {
              return (
                <button
                  key={entry.id}
                  type="button"
                  role={props.role}
                  tabIndex={props.tabIndex}
                  className={props.className}
                  ref={props.ref}
                  data-dropdown-item-id={props['data-dropdown-item-id']}
                  onClick={() => {
                    entry.onSelect();
                    props.onClick();
                  }}
                >
                  {entry.label}
                </button>
              );
            }

            // EL ÍTEM DE FORMULARIO NO CIERRA EL MENÚ AL CLICK. Cerrarlo desmonta
            // el panel, y con él el <form>: React aplica el cambio de estado
            // antes de que el navegador ejecute el envío (que es la acción por
            // defecto del click, y corre DESPUÉS de los listeners). Cuando el
            // envío llega, el formulario ya no está en el documento y el
            // navegador lo cancela en silencio — "Form submission canceled
            // because the form is not connected". Así se veía "Cerrar sesión"
            // en escritorio: el menú se cerraba y la sesión seguía abierta. En
            // el teléfono andaba porque ahí el formulario es plano y nadie lo
            // desmonta. La acción de servidor redirige, y la navegación es la
            // que se lleva el menú.
            return (
              <form key={entry.id} role="none" action={entry.action} className={styles.itemSlot}>
                <button
                  type="submit"
                  role={props.role}
                  tabIndex={props.tabIndex}
                  className={props.className}
                  ref={props.ref}
                  data-dropdown-item-id={props['data-dropdown-item-id']}
                >
                  {entry.label}
                </button>
              </form>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
