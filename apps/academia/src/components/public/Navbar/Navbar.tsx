"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@zephyra/utils";
import { Brandmark } from "@/components/public/Brandmark";
import { AccountMenu } from "@/components/public/AccountMenu";
import { MobileAccountLinks } from "@/components/public/MobileAccountLinks";
import {
  ACADEMIA_HOME,
  ACADEMIA_NAV_LINKS,
  ACADEMIA_SIGNIN_LINK,
} from "@/lib/academia-nav";
import type { PublicLearnerSession } from "@/features/auth-learner/lib/public-session";
import styles from "./Navbar.module.css";

// LA BARRA DE LA ACADEMIA ES DE LA ACADEMIA (Tomas, 2026-09-25). Hasta acá
// mostraba los seis enlaces del sitio institucional —Inicio, Servicios, Equipo,
// Proyectos, Perspectivas, Contacto—, heredados tal cual por el split: seis
// maneras de IRSE del producto y ninguna de moverse adentro. La pregunta estaba
// reservada por escrito en @/lib/institutional-links; ésta es la respuesta, y
// vive en @/lib/academia-nav.
const navLinks = ACADEMIA_NAV_LINKS;

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
          {/* La marca lleva a la casa de la ACADEMIA. Antes llevaba al sitio
              institucional: quien tocaba el logo estando en un curso se iba del
              producto sin querer. El camino de vuelta a la consultora sigue
              existiendo, con nombre propio, en los enlaces de al lado. */}
          <Link
            href={ACADEMIA_HOME}
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
              {/* Sin sesion, la puerta de entrada. Con sesion no va: al lado
                  esta el menu de cuenta, y dos entradas para lo mismo confunden. */}
              {session ? null : (
                <li>
                  <Link
                    href={ACADEMIA_SIGNIN_LINK.href}
                    className={styles.navLink}
                  >
                    {ACADEMIA_SIGNIN_LINK.label}
                  </Link>
                </li>
              )}
            </ul>
            {/* A la derecha de los enlaces institucionales, y SOLO con sesion.
                Sin sesion no se renderiza nada: la barra queda identica.

                El envoltorio NO es decorativo: es el elemento sobre el que la
                barra decide que en telefono el desplegable no va (las entradas
                se alcanzan dentro del menu movil). Ponerlo sobre el componente
                mismo no alcanza — comparte clase `.root` con la primitiva y la
                cascada decide por orden de bundle. */}
            {session ? (
              <div className={styles.accountSlot}>
                <AccountMenu session={session} />
              </div>
            ) : null}
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
          {session ? null : (
            <li>
              <Link
                href={ACADEMIA_SIGNIN_LINK.href}
                className={styles.mobileNavLink}
                onClick={closeMobileMenu}
              >
                {ACADEMIA_SIGNIN_LINK.label}
              </Link>
            </li>
          )}
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
