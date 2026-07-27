import Link from "next/link";
import styles from "../Compra.module.css";

// The failure return is purely informational — there is no DB state to trust
// here beyond "the buyer bounced back on the failure path". We do not mark the
// order failed from this page (only the authoritative webhook does that); we
// simply offer a retry back to the course detail.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Compra no completada — Zephyra Cursos",
};

export default async function CompraErrorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

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
          <Link href={`/cursos/${slug}`} className={styles.button}>
            Intentar de nuevo
          </Link>
        </div>
      </section>
    </main>
  );
}
