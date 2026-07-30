'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '@zephyra/convex/_generated/api';
import type { Id } from '@zephyra/convex/_generated/dataModel';

interface PackPendingPollerProps {
  orderId: Id<'lmsOrders'>;
}

/**
 * Live-refresh helper for the empresa /compra/pendiente page (api-contract §3).
 *
 * The pack webhook mints the seat pack seconds after the buyer is redirected
 * back. We subscribe to the order via Convex live query (getOrderById) — the
 * moment it flips to "paid" (pack minted) we navigate the owner to the empresa
 * success page. No polling loop. Renders nothing.
 */
export function PackPendingPoller({ orderId }: PackPendingPollerProps) {
  const router = useRouter();
  const order = useQuery(api.lms.payment.orders.getOrderById, { orderId });

  useEffect(() => {
    if (order?.status === 'paid') {
      router.replace(`/empresa/compra/exito?orderId=${orderId}`);
    }
  }, [order?.status, router, orderId]);

  return null;
}
