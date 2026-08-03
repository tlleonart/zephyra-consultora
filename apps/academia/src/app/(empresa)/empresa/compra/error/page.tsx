import Link from 'next/link';
import { btnClass } from '@zephyra/ui';
import styles from '../Compra.module.css';

// Informational only: no DB state to trust beyond "the buyer bounced on the
// failure path". We do not mark the order failed here (only the authoritative
// webhook does); we offer a retry back to the catalog.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Compra no completada — Zephyra Empresas',
};

export default function PackCompraErrorPage() {
  return (
    <main className={styles.wrapper}>
      <section className={styles.card} aria-labelledby="compra-title">
        <div className={`${styles.icon} ${styles.iconError}`} aria-hidden="true">
          ✕
        </div>
        <h1 id="compra-title" className={styles.title}>
          No pudimos completar la compra
        </h1>
        <p className={styles.message}>
          El pago no se concretó. No se realizó ningún cargo. Podés intentar
          nuevamente o elegir otro medio de pago.
        </p>
        <div className={styles.actions}>
          <Link href="/empresa/cursos" className={btnClass({ size: 'lg' })}>
            Volver al catálogo
          </Link>
        </div>
      </section>
    </main>
  );
}
