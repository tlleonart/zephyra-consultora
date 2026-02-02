'use client';

import Link from 'next/link';
import styles from './error.module.css';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <span className={styles.icon}>
          <span className="material-icons">error_outline</span>
        </span>
        <h1 className={styles.title}>Algo salio mal</h1>
        <p className={styles.message}>
          Lo sentimos, ha ocurrido un error inesperado. Por favor, intenta de nuevo o vuelve al inicio.
        </p>
        <div className={styles.actions}>
          <button onClick={reset} className={styles.button}>
            Intentar de nuevo
          </button>
          <Link href="/" className={styles.link}>
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
