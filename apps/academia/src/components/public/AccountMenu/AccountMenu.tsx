'use client';

import Link from 'next/link';
import { DropdownMenu, type DropdownMenuEntry } from '@zephyra/ui';
import { signOutLearner } from '@/features/auth-learner/actions/signout';
import {
  accountMenuLinks,
  learnerInitial,
} from '@/features/auth-learner/lib/account-menu-links';
import type { PublicLearnerSession } from '@/features/auth-learner/lib/public-session';
import styles from './AccountMenu.module.css';

/**
 * El menú de cuenta de la barra, en escritorio.
 *
 * Es el punto donde la Academia por fin dice quién está adentro. Los tres
 * testers chocaron con lo mismo: no había forma de cerrar sesión, y "puedo
 * volver a entrar" no la pudo ejecutar ninguno.
 *
 * SIN SESIÓN ESTE COMPONENTE NO SE MONTA. La barra sin sesión queda idéntica a
 * como estaba, y no se agrega "Iniciar sesión": el llamado a la acción del
 * producto es comprar, y la ficha del curso ya lleva a autenticarse con su
 * intención preservada. Un enlace de sesión en la barra compite con eso.
 *
 * La identidad viaja recortada a `email` y `type` — nunca `learnerId`,
 * `organizationId` ni `exp`. La resuelve el layout del lado del servidor, así
 * que la barra se pinta ya con la sesión puesta y no parpadea.
 */

/**
 * Las entradas del menú, armadas desde la lista compartida.
 *
 * Exportada a propósito: es la regla de "Mi empresa sólo para `org_admin`" y la
 * de "el correo es identidad, no un ítem accionable", y las dos se verifican
 * sin DOM, tipo de sesión por tipo de sesión.
 */
export const buildAccountMenuEntries = (
  session: PublicLearnerSession
): DropdownMenuEntry[] => {
  const links = accountMenuLinks(session.type);
  const entries: DropdownMenuEntry[] = [
    // La identidad se lee y no se acciona: no recibe foco ni cuenta para el
    // recorrido con flechas.
    { kind: 'label', id: 'identidad', content: session.email },
    { kind: 'separator', id: 'sep-identidad' },
  ];

  links.forEach((link, index) => {
    // Un separador donde cambia el grupo, sin que nadie tenga que saber cuántas
    // entradas hay: si "Mi empresa" no está, tampoco está su separador, y no
    // quedan dos rayas pegadas.
    const previous = links[index - 1];
    if (previous && previous.group !== link.group) {
      entries.push({ kind: 'separator', id: `sep-${link.group}` });
    }
    entries.push({
      // Navegación: el elemento lo elige esta app, no el paquete de interfaz.
      // Reescribir un <Link> como <button> pierde el href, el click del medio y
      // el rol correcto para tecnología asistiva.
      kind: 'custom',
      id: link.id,
      render: (props) => (
        <Link href={link.href} {...props}>
          {link.label}
        </Link>
      ),
    });
  });

  entries.push(
    { kind: 'separator', id: 'sep-salir' },
    {
      // `<form action={serverAction}>`, el mismo patrón que ya usa el cierre de
      // sesión de la superficie de empresa. No se inventa uno nuevo.
      kind: 'form',
      id: 'cerrar-sesion',
      label: 'Cerrar sesión',
      action: signOutLearner,
    }
  );

  return entries;
};

export interface AccountMenuProps {
  session: PublicLearnerSession;
}

export const AccountMenu = ({ session }: AccountMenuProps) => (
  <DropdownMenu
    // Lo que anuncia un lector de pantalla tiene que decir DE QUIÉN es el menú.
    // "Menú" no alcanza: la barra ya tiene otro.
    triggerLabel={`Mi cuenta — ${session.email}`}
    triggerContent={
      // La inicial es decorativa: repite el correo, que ya está en el nombre
      // accesible. Anunciarla otra vez sería leer "N, Mi cuenta nati@…".
      <span aria-hidden="true">{learnerInitial(session.email)}</span>
    }
    entries={buildAccountMenuEntries(session)}
    align="end"
    className={styles.root}
  />
);
