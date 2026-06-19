/**
 * Convex HTTP router.
 *
 * Public HTTP endpoints exposed by the Convex deployment. Convex auto-mounts
 * the default export of this file. Each route maps a path + method to an
 * httpAction handler.
 *
 * LMS money-path (Sprint 2 Phase P0): the MercadoPago webhook. MP POSTs
 * payment notifications here; the handler verifies the x-signature HMAC,
 * fetches authoritative state, and (transactionally) records the payment +
 * grants the enrollment. See convex/lms/payment/webhook.ts.
 */

import { httpRouter } from "convex/server";
import { handleMercadoPagoWebhook } from "./lms/payment/webhook";

const http = httpRouter();

http.route({
  path: "/api/lms/mp/webhook",
  method: "POST",
  handler: handleMercadoPagoWebhook,
});

export default http;
