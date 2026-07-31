import Link from "next/link";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@zephyra/convex/_generated/api";
import type { Id } from "@zephyra/convex/_generated/dataModel";
import styles from "../Compra.module.css";
import { btnClass } from "@zephyra/ui";

// DB is truth: never trust the /exito path MercadoPago redirected to as proof
// of payment. We read the REAL order status from Convex by id and render
// accordingly. force-dynamic because the order status changes server-side as
// the webhook lands.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Compra confirmada — Zephyra Cursos",
};

export default async function CompraExitoPage({
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

  // status:"paid" → the webhook has confirmed payment + granted the enrollment.
  const isPaid = order?.status === "paid";

  return (
    <main className={styles.wrapper}>
      <section className={styles.card} aria-labelledby="compra-title">
        <div
          className={`${styles.icon} ${isPaid ? styles.iconSuccess : styles.iconPending}`}
          aria-hidden="true"
        >
          {isPaid ? "✓" : "⏳"}
        </div>
        <h1 id="compra-title" className={styles.title}>
          {isPaid ? "¡Compra confirmada!" : "Procesando tu compra"}
        </h1>
        <p className={styles.message}>
          {isPaid
            ? "Tu pago fue acreditado y ya tenés acceso al curso. Podés empezar cuando quieras."
            : "Recibimos tu pago y lo estamos confirmando. En cuanto se acredite, tu acceso al curso se habilita automáticamente."}
        </p>
        <div className={styles.actions}>
          {isPaid ? (
            <Link href={`/cursos/${slug}/player`} className={btnClass({ size: "lg" })}>
              Ir al curso
            </Link>
          ) : (
            <Link
              href={`/cursos/${slug}`}
              className={btnClass({ variant: "outline", size: "lg" })}
            >
              Volver al curso
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
