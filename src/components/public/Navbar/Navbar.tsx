'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/cn';
import styles from './Navbar.module.css';

const navLinks = [
  { href: '/', label: 'Inicio' },
  { href: '/#servicios', label: 'Servicios' },
  { href: '/proyectos', label: 'Proyectos' },
  { href: '/blog', label: 'Blog' },
  { href: '/contacto', label: 'Contacto' },
];

export const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <header className={cn(styles.header, isScrolled && styles.scrolled)}>
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
        </ul>

        {/* Mobile Menu Button */}
        <button
          className={cn(styles.hamburger, isMobileMenuOpen && styles.active)}
          onClick={toggleMobileMenu}
          aria-label={isMobileMenuOpen ? 'Cerrar menu' : 'Abrir menu'}
          aria-expanded={isMobileMenuOpen}
        >
          <span className={styles.hamburgerLine}></span>
          <span className={styles.hamburgerLine}></span>
          <span className={styles.hamburgerLine}></span>
        </button>

        {/* Mobile Menu */}
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
      </nav>
    </header>
  );
};
