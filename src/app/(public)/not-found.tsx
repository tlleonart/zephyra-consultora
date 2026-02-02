import Link from 'next/link';
import styles from './not-found.module.css';

export default function NotFound() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <span className={styles.code}>404</span>
        <h1 className={styles.title}>Pagina no encontrada</h1>
        <p className={styles.message}>
          Lo sentimos, la pagina que buscas no existe o ha sido movida.
        </p>
        <Link href="/" className={styles.button}>
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
