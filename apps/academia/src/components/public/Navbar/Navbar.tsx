"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@zephyra/utils";
import { Brandmark } from "@/components/public/Brandmark";
import { AccountMenu } from "@/components/public/AccountMenu";
import { MobileAccountLinks } from "@/components/public/MobileAccountLinks";
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
   * SIN SESION LA BARRA NO CAMBIA: no se agrega "Iniciar sesion". El llamado a
   * la accion del producto es comprar, y la ficha del curso ya lleva a
   * autenticarse con su intencion preservada. Un enlace de sesion en la barra
   * compite con eso.
   *
   * CON SESION aparece el menu de cuenta: en escritorio a la derecha de los
   * enlaces institucionales, y en telefono dentro del menu movil.
   */
  session?: PublicLearnerSession | null;
}

export const Navbar = ({ session = null }: NavbarProps = {}) => {
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
          <div className={styles.navGroup}>
            <ul className={styles.navLinks}>
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={styles.navLink}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            {/* A la derecha de los enlaces institucionales, y SOLO con sesion.
                Sin sesion no se renderiza nada: la barra queda identica. */}
            {session ? <AccountMenu session={session} /> : null}
          </div>

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
          {/* El area de cuenta, alcanzable DENTRO del menu movil. Plana y no
              como un segundo desplegable: esta pantalla ya se abrio con el
              hamburguesa, y anidar otro revelado serian dos toques para llegar
              a lo mismo. Las entradas salen de la misma lista que el
              desplegable de escritorio. */}
          {session ? (
            <MobileAccountLinks session={session} onNavigate={closeMobileMenu} />
          ) : null}
        </ul>
      </div>
    </>
  );
};
