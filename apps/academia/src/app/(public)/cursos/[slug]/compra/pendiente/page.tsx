import Link from "next/link";
import { ConvexHttpClient } from "convex/browser";
import { PendingPoller } from "@/features/lms-checkout/components/PendingPoller";
import { api } from "@zephyra/convex/_generated/api";
import type { Id } from "@zephyra/convex/_generated/dataModel";
import styles from "../Compra.module.css";

// DB is truth: the order status drives the copy, not the /pendiente path. If
// the webhook already landed (status "paid") we send the buyer straight to the
// player; otherwise the PendingPoller subscribes to the order and redirects the
// moment it flips to paid.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Compra en proceso — Zephyra Cursos",
};

export default async function CompraPendientePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { slug } = await params;
  const { orderId } = await searchParams;

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const order = orderId
    ? await convex.query(api.lms.payment.orders.getOrderById, {
        orderId: orderId as Id<"lmsOrders">,
      })
    : null;

  const isPaid = order?.status === "paid";

  return (
    <main className={styles.wrapper}>
      {order && !isPaid ? (
        <PendingPoller orderId={order._id} slug={slug} />
      ) : null}
      <section className={styles.card} aria-labelledby="compra-title">
        <div
          className={`${styles.icon} ${isPaid ? styles.iconSuccess : styles.iconPending}`}
          aria-hidden="true"
        >
          {isPaid ? "✓" : "⏳"}
        </div>
        <h1 id="compra-title" className={styles.title}>
          {isPaid ? "¡Pago acreditado!" : "Estamos confirmando tu pago"}
        </h1>
        <p className={styles.message} aria-live="polite">
          {isPaid
            ? "Tu pago se acreditó y ya tenés acceso al curso."
            : "Algunos medios de pago tardan unos minutos en confirmarse. Esta página se actualiza sola en cuanto se acredite — no hace falta que la recargues."}
        </p>
        <div className={styles.actions}>
          {isPaid ? (
            <Link href={`/cursos/${slug}/player`} className={styles.button}>
              Ir al curso
            </Link>
          ) : (
            <Link
              href={`/cursos/${slug}`}
              className={`${styles.button} ${styles.buttonSecondary}`}
            >
              Volver al curso
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
