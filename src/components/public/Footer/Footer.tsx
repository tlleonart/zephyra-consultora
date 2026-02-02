import Link from 'next/link';
import styles from './Footer.module.css';

const quickLinks = [
  { href: '/', label: 'Inicio' },
  { href: '/#servicios', label: 'Servicios' },
  { href: '/proyectos', label: 'Proyectos' },
  { href: '/blog', label: 'Blog' },
  { href: '/contacto', label: 'Contacto' },
];

const socialLinks = [
  {
    href: 'https://instagram.com/zephyraconsultora',
    label: 'Instagram',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    ),
  },
  {
    href: 'https://linkedin.com/company/zephyraconsultora',
    label: 'LinkedIn',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
        <rect x="2" y="9" width="4" height="12" />
        <circle cx="4" cy="4" r="2" />
      </svg>
    ),
  },
];

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.content}>
          {/* Company Info Column */}
          <div className={styles.column}>
            <Link href="/" className={styles.logo}>
              Zephyra
            </Link>
            <p className={styles.description}>
              Consultora especializada en sostenibilidad e impacto social.
              Acompanamos a organizaciones en su camino hacia un futuro mas
              responsable y sostenible.
            </p>
            <div className={styles.contactInfo}>
              <a href="mailto:info@zephyraconsultora.com" className={styles.contactLink}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                info@zephyraconsultora.com
              </a>
              <span className={styles.contactLink}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                Rosario, Argentina
              </span>
            </div>
          </div>

          {/* Quick Links Column */}
          <div className={styles.column}>
            <h3 className={styles.columnTitle}>Enlaces</h3>
            <ul className={styles.linkList}>
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={styles.link}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className={styles.bottom}>
          <p className={styles.copyright}>
            &copy; {currentYear} Zephyra Consultora. Todos los derechos reservados.
          </p>
          <div className={styles.socialLinks}>
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.socialLink}
                aria-label={social.label}
              >
                {social.icon}
              </a>
            ))}
          </div>
        </div>

        {/* Developer Credit */}
        <div className={styles.developerCredit}>
          <p>
            Desarrollado por{' '}
            <a
              href="https://carbono14.com"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.developerLink}
            >
              Carbono14
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};
