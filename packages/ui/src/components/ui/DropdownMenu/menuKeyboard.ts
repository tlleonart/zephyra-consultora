/**
 * La máquina de teclado del menú desplegable, SEPARADA del componente y pura.
 *
 * POR QUÉ VIVE APARTE. El requisito de accesibilidad de este menú es
 * bloqueante, no una preferencia: se abre y se opera sólo con teclado, el foco
 * entra al menú al abrirlo, `Escape` cierra y devuelve el foco al disparador. Si
 * esas reglas viven mezcladas con `useState`, refs y efectos, la única forma de
 * verificarlas es un navegador — y el único navegador de este repo está en
 * Playwright, que corre al final y contra la aplicación entera.
 *
 * Acá las decisiones son una función de (tecla, estado, cantidad de ítems) a
 * intención. Eso se prueba exhaustivamente en el runner de unidad, tecla por
 * tecla y borde por borde, sin DOM. El componente queda reducido a aplicar la
 * intención: mover el foco al ítem, o al disparador, y nada más.
 *
 * Lo que ESTA capa no puede probar —que el foco se vea, que el navegador
 * realmente lo mueva, que un lector de pantalla anuncie el menú— se verifica en
 * Playwright. Las dos capas hacen falta y ninguna reemplaza a la otra.
 */

export interface MenuState {
  open: boolean;
  /** Índice del ítem enfocado. -1 = ninguno (menú cerrado, o abierto sin foco). */
  activeIndex: number;
}

export const CLOSED_MENU: MenuState = { open: false, activeIndex: -1 };

/** A quién hay que darle el foco después de aplicar el nuevo estado. */
export type MenuFocusTarget = 'trigger' | 'item' | 'none';

export interface MenuKeyResult {
  state: MenuState;
  focus: MenuFocusTarget;
  /**
   * `true` si el evento se consumió: el llamador hace `preventDefault()`.
   *
   * Cuidado con la tentación de consumir todo. `Enter` sobre un ítem NO se
   * consume a propósito: los ítems del menú pueden ser anclas, y una ancla se
   * activa nativamente con Enter. Consumirlo obligaría a re-implementar la
   * navegación a mano y a perder click del medio, "abrir en pestaña nueva" y el
   * rol correcto para tecnología asistiva.
   */
  handled: boolean;
  /**
   * `true` cuando la tecla tiene que activar el ítem enfocado y el navegador NO
   * lo va a hacer solo. En la práctica: la barra espaciadora sobre un ancla.
   */
  activate: boolean;
}

const noop = (state: MenuState): MenuKeyResult => ({
  state,
  focus: 'none',
  handled: false,
  activate: false,
});

/** Las dos grafías de la barra espaciadora que mandan los navegadores. */
const isSpace = (key: string): boolean => key === ' ' || key === 'Spacebar';

/**
 * Decide qué hacer con una tecla.
 *
 * CERRADO (con al menos un ítem)
 *   ArrowDown / Enter / Espacio → abre y enfoca el PRIMER ítem
 *   ArrowUp                     → abre y enfoca el ÚLTIMO ítem
 *   cualquier otra              → no se toca nada
 *
 * ABIERTO
 *   ArrowDown / ArrowUp → mueve con vuelta circular
 *   Home / End          → primero / último
 *   Escape              → cierra y DEVUELVE EL FOCO AL DISPARADOR
 *   Tab                 → cierra, sin consumir: la tabulación sigue su curso
 *                         natural fuera del menú, que es lo que espera quien
 *                         navega con teclado. Cerrar sin consumir es
 *                         deliberado; consumirlo dejaría a la persona atrapada.
 *   Espacio             → activa el ítem enfocado (un ancla no se activa sola)
 *   Enter               → no se consume: lo activa el navegador
 *
 * SIN ÍTEMS el menú no abre nunca. Un menú abierto y vacío es una trampa de
 * foco: no hay a dónde mandarlo y `Escape` sería la única salida.
 */
export const resolveMenuKey = (
  key: string,
  state: MenuState,
  itemCount: number
): MenuKeyResult => {
  if (itemCount <= 0) {
    // Con el menú abierto y sin ítems (sólo posible si los ítems desaparecen
    // debajo), Escape sigue siendo la salida.
    if (state.open && key === 'Escape') {
      return { state: CLOSED_MENU, focus: 'trigger', handled: true, activate: false };
    }
    return noop(state);
  }

  const last = itemCount - 1;

  if (!state.open) {
    if (key === 'ArrowDown' || key === 'Enter' || isSpace(key)) {
      return {
        state: { open: true, activeIndex: 0 },
        focus: 'item',
        handled: true,
        activate: false,
      };
    }
    if (key === 'ArrowUp') {
      return {
        state: { open: true, activeIndex: last },
        focus: 'item',
        handled: true,
        activate: false,
      };
    }
    return noop(state);
  }

  // Menú abierto. `activeIndex` puede ser -1 si se abrió con el puntero.
  const current = state.activeIndex;

  switch (key) {
    case 'ArrowDown':
      return {
        state: { open: true, activeIndex: current < 0 ? 0 : (current + 1) % itemCount },
        focus: 'item',
        handled: true,
        activate: false,
      };
    case 'ArrowUp':
      return {
        state: {
          open: true,
          activeIndex: current < 0 ? last : (current - 1 + itemCount) % itemCount,
        },
        focus: 'item',
        handled: true,
        activate: false,
      };
    case 'Home':
      return {
        state: { open: true, activeIndex: 0 },
        focus: 'item',
        handled: true,
        activate: false,
      };
    case 'End':
      return {
        state: { open: true, activeIndex: last },
        focus: 'item',
        handled: true,
        activate: false,
      };
    case 'Escape':
      return { state: CLOSED_MENU, focus: 'trigger', handled: true, activate: false };
    case 'Tab':
      return { state: CLOSED_MENU, focus: 'none', handled: false, activate: false };
    case 'Enter':
      // Sin consumir: el navegador activa el ancla o el botón enfocado. El menú
      // se cierra desde el `onClick` del ítem, que dispara igual.
      return noop(state);
    default:
      if (isSpace(key) && current >= 0) {
        return {
          state,
          focus: 'none',
          handled: true,
          activate: true,
        };
      }
      return noop(state);
  }
};
