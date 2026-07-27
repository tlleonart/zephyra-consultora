"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

interface PendingPollerProps {
  orderId: Id<"lmsOrders">;
  slug: string;
}

/**
 * Live-refresh helper for the /compra/pendiente page.
 *
 * The webhook may land seconds after the buyer is redirected back. Rather than
 * a blunt full-page meta-refresh, we subscribe to the order via Convex's live
 * query: the moment the webhook flips the order to "paid", this component
 * navigates the learner to the player. Convex reactivity is the refresh — no
 * polling loop, no flashing reload. Renders nothing.
 */
export function PendingPoller({ orderId, slug }: PendingPollerProps) {
  const router = useRouter();
  const order = useQuery(api.lms.payment.orders.getOrderById, { orderId });

  useEffect(() => {
    if (order?.status === "paid") {
      router.replace(`/cursos/${slug}/compra/exito?orderId=${orderId}`);
    }
  }, [order?.status, router, slug, orderId]);

  return null;
}
