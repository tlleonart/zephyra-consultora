"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@zephyra/utils";
import { ACADEMIA_HOME_URL, ACADEMIA_LABEL } from "@/lib/academia-link";
import styles from "./Navbar.module.css";

const navLinks = [
  { href: "/", label: "Inicio" },
  { href: "/#servicios", label: "Servicios" },
  { href: "/#equipo", label: "Equipo" },
  { href: "/proyectos", label: "Proyectos" },
  { href: "/blog", label: "Perspectivas" },
  { href: "/contacto", label: "Contacto" },
];

export const Navbar = () => {
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
          <Link href="/" className={styles.logo} onClick={closeMobileMenu}>
            <Image
              src="/images/zephyra-logo.png"
              alt="Zephyra Consultora"
              width={160}
              height={40}
              priority
              className={styles.logoImage}
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
            {/* ACADEMIA. Va en el índice del sitio principal y NO se lee como
                un ítem más: es la marca del producto, con el mismo tratamiento
                tipográfico que el descriptor del logo de Academia Zephyra.
                Lleva a otro host, así que Next lo emite como ancla y no
                prefetchea. */}
            <li>
              <Link
                href={ACADEMIA_HOME_URL}
                className={cn(styles.navLink, styles.academiaLink)}
              >
                {ACADEMIA_LABEL}
              </Link>
            </li>
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
          <li>
            <Link
              href={ACADEMIA_HOME_URL}
              className={cn(styles.mobileNavLink, styles.academiaLink)}
              onClick={closeMobileMenu}
            >
              {ACADEMIA_LABEL}
            </Link>
          </li>
        </ul>
      </div>
    </>
  );
};
