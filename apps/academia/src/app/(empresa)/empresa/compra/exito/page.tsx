import Link from 'next/link';
import { ConvexHttpClient } from 'convex/browser';
import { formatUsd } from '@/features/lms-checkout/lib/format-price';
import { api } from '@zephyra/convex/_generated/api';
import type { Id } from '@zephyra/convex/_generated/dataModel';
import styles from '../Compra.module.css';

// DB is truth (api-contract §3): we read the REAL order status by id, never the
// MP back_url path. status:"paid" ⇒ the webhook minted the seat pack server-side.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Compra confirmada — Zephyra Empresas',
};

export default async function PackCompraExitoPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const order = orderId
    ? await convex.query(api.lms.payment.orders.getOrderById, {
        orderId: orderId as Id<'lmsOrders'>,
      })
    : null;

  const isPaid = order?.status === 'paid';

  return (
    <main className={styles.wrapper}>
      <section className={styles.card} aria-labelledby="compra-title">
        <div
          className={`${styles.icon} ${isPaid ? styles.iconSuccess : styles.iconPending}`}
          aria-hidden="true"
        >
          {isPaid ? '✓' : '⏳'}
        </div>
        <h1 id="compra-title" className={styles.title}>
          {isPaid ? '¡Compra confirmada!' : 'Procesando tu compra'}
        </h1>
        <p className={styles.message}>
          {isPaid
            ? 'Tu pago se acreditó y los lugares para tu equipo ya están disponibles. Asignalos a tu equipo desde tu panel.'
            : 'Recibimos tu pago y lo estamos confirmando. En cuanto se acredite, los lugares de tu equipo se habilitan automáticamente.'}
        </p>
        {order ? (
          <p className={styles.total}>
            {order.seatCount
              ? `${order.seatCount} ${order.seatCount === 1 ? 'licencia' : 'licencias'} · ${formatUsd(order.priceUsd)}`
              : formatUsd(order.priceUsd)}
          </p>
        ) : null}
        <div className={styles.actions}>
          <Link href="/empresa" className={styles.button}>
            Ir a mi panel
          </Link>
        </div>
      </section>
    </main>
  );
}
