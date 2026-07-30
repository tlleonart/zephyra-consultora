import Link from 'next/link';
import { ConvexHttpClient } from 'convex/browser';
import { PackPendingPoller } from '@/features/packs/components/PackPendingPoller';
import { formatUsd } from '@/features/lms-checkout/lib/format-price';
import { api } from '@zephyra/convex/_generated/api';
import type { Id } from '@zephyra/convex/_generated/dataModel';
import styles from '../Compra.module.css';

// DB is truth: the order status drives the copy. If the webhook already landed
// (status "paid") we point to the panel; otherwise PackPendingPoller subscribes
// to the order and redirects to the success page the moment it flips to paid.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Compra en proceso — Zephyra Empresas',
};

export default async function PackCompraPendientePage({
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
      {order && !isPaid ? <PackPendingPoller orderId={order._id} /> : null}
      <section className={styles.card} aria-labelledby="compra-title">
        <div
          className={`${styles.icon} ${isPaid ? styles.iconSuccess : styles.iconPending}`}
          aria-hidden="true"
        >
          {isPaid ? '✓' : '⏳'}
        </div>
        <h1 id="compra-title" className={styles.title}>
          {isPaid ? '¡Pago acreditado!' : 'Estamos confirmando tu pago'}
        </h1>
        <p className={styles.message} aria-live="polite">
          {isPaid
            ? 'Tu pago se acreditó y los lugares para tu equipo ya están disponibles.'
            : 'Algunos medios de pago tardan unos minutos en confirmarse. Esta página se actualiza sola en cuanto se acredite — no hace falta que la recargues.'}
        </p>
        {order ? (
          <p className={styles.total}>{formatUsd(order.priceUsd)}</p>
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
