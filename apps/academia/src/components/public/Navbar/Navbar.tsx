"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@zephyra/utils";
import { Brandmark } from "@/components/public/Brandmark";
import {
  INSTITUTIONAL_HOME,
  INSTITUTIONAL_NAV_LINKS,
} from "@/lib/institutional-links";
import type { PublicLearnerSession } from "@/features/auth-learner/lib/public-session";
import styles from "./Navbar.module.css";

// These six labels point at routes www owns and this app does not serve. They
// were relative when the split copied this component over, so all six 404'd on
// this host. @/lib/institutional-links explains the fix and holds the reserved
// IA question about whether "Inicio" and the logo should stay pointed off-site.
const navLinks = INSTITUTIONAL_NAV_LINKS;

export interface NavbarProps {
  /**
   * La sesion de la alumna, YA RECORTADA a lo que puede ver el navegador
   * (`email` y `type`). La resuelve `(public)/layout.tsx` del lado del
   * servidor y la baja como prop; este componente es cliente y no puede
   * leer cookies. `null` = sin sesion.
   *
   * SIN SESION LA BARRA NO CAMBIA (AC 1): no se agrega "Iniciar sesion". El
   * llamado a la accion del producto es comprar, y la ficha del curso ya
   * lleva a autenticarse con su intencion preservada (SPEC §3.1).
   *
   * CON SESION todavia no cambia nada TAMPOCO: el disparador y el menu de
   * cuenta los monta T-fe-005 sobre esta prop. T-fe-003 entrega el cableado
   * servidor -> barra y el recorte del payload, no la interfaz.
   */
  session?: PublicLearnerSession | null;
}

/* El consumidor de `session` es T-fe-005 (<AccountMenu session={session} />).
   La prop se DECLARA y se CABLEA en T-fe-003, antes de que exista la interfaz,
   por dos razones que no son de comodidad: el layout tiene que resolver la
   sesion en el servidor para que no haya parpadeo (AC 13), y el recorte a
   {email,type} tiene que quedar fijado por test antes de que exista superficie
   capaz de filtrar el resto (AC 11). Hasta T-fe-005 la barra se pinta igual
   con sesion y sin ella; el disable es de esa ventana, no permanente. */
export const Navbar = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  session = null,
}: NavbarProps = {}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <header className={cn(styles.header, isScrolled && styles.scrolled, isMobileMenuOpen && styles.menuOpen)}>
        <nav className={styles.nav}>
          <Link
            href={INSTITUTIONAL_HOME}
            className={styles.logo}
            onClick={closeMobileMenu}
          >
            {/* D-1/D-2 live in @/lib/brand, not here. */}
            <Brandmark
              /* La barra es papel, asi que la marca va en su variante clara.
                 PERO con el menu movil abierto la barra se transparenta sobre
                 un overlay VERDE: ahi la marca oscura desaparece. Mismo caso
                 que las lineas del hamburguesa, que vuelven a blanco por CSS;
                 la marca es un <Image> con src distinto por variante, asi que
                 tiene que conmutar en el componente y no en la hoja de estilo. */
              tone={isMobileMenuOpen ? "onDark" : "onLight"}
              height={40}
              priority
            />
          </Link>

          {/* Desktop Navigation */}
          <ul className={styles.navLinks}>
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={styles.navLink}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Mobile Menu Button */}
          <button
            className={cn(styles.hamburger, isMobileMenuOpen && styles.active)}
            onClick={toggleMobileMenu}
            aria-label={isMobileMenuOpen ? "Cerrar menu" : "Abrir menu"}
            aria-expanded={isMobileMenuOpen}
          >
            <span className={styles.hamburgerLine}></span>
            <span className={styles.hamburgerLine}></span>
            <span className={styles.hamburgerLine}></span>
          </button>
        </nav>
      </header>

      {/* Mobile Menu — outside header to avoid backdrop-filter containing block issue */}
      <div className={cn(styles.mobileMenu, isMobileMenuOpen && styles.open)}>
        <ul className={styles.mobileNavLinks}>
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={styles.mobileNavLink}
                onClick={closeMobileMenu}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};
