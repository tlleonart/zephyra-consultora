/**
 * M4 — boundaries v1.1 §5, the backend-owned rows. MONEY PATH.
 *
 *   §5 row 6  Buyer confirmation (B2C + pack)  Convex  ->  academia.*
 *   §5 row 7  MercadoPago back_urls            Convex  ->  academia.*
 *             MercadoPago webhook              Convex  ->  the Convex HTTP endpoint
 *
 * The sibling suites (paymentCheckoutSession, paymentBuyerEmail) already pin URL
 * SHAPE using a neutral test host. This suite pins HOST OWNERSHIP against the
 * literal production value from boundaries §3.1, which is the thing M4 changed
 * and the thing a future edit could silently undo.
 *
 * Why the pack row is called out separately: the B2B back_urls target
 * /empresa/compra/*, and the M6 301 map (boundaries §3.1, T-fe-016) contains only
 * /cursos/:path* and /admin/:path*. So for a pack buyer there is no redirect
 * safety net at all — a wrong host here means MercadoPago has already taken the
 * money and the buyer lands on a 404.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MercadoPagoAdapter } from "../../../../convex/lms/payment/mercadopago";

/** Production origin of apps/academia (boundaries v1.1 §3.1). */
const ACADEMIA = "https://academia.zephyraconsultora.com";
/** The institutional apex — must never appear in a generated backend URL. */
const APEX = "https://zephyraconsultora.com";
/** The Convex deployment's HTTP origin (where the webhook lives). */
const CONVEX_SITE = "https://corgi-88.convex.site";

const ORDER = {
  orderId: "lmsOrders-abc",
  customerId: "lmsCustomers-1",
  courseId: "lmsCourses-1",
  priceUsd: 90,
  currency: "USD" as const,
  payerEmail: "learner@example.com",
  courseTitle: "Sostenibilidad 101",
  courseSlug: "sostenibilidad-101",
};

const originalFetch = global.fetch;
const ORIGINAL_ENV = { ...process.env };

const mockFetchOnce = () => {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: "",
    json: async () => ({
      id: "pref-123",
      init_point: "https://mp.com/checkout/pref-123",
    }),
  }));
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

/** Parse the preference body the adapter POSTed to MercadoPago. */
const bodyOf = (
  fetchMock: ReturnType<typeof mockFetchOnce>
): {
  back_urls: { success: string; failure: string; pending: string };
  notification_url: string;
} => {
  const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  return JSON.parse(init.body as string);
};

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.env.MP_ACCESS_TOKEN = "test-access-token";
  process.env.MP_WEBHOOK_SECRET = "test-webhook-secret";
  process.env.MP_PUBLIC_KEY = "test-public-key";
  process.env.CONVEX_SITE_URL = CONVEX_SITE;
  // The canonical variable. The deprecated alias is deliberately absent so this
  // suite proves the NEW name is the one actually read.
  process.env.ZEPHYRA_ACADEMIA_URL = ACADEMIA;
  delete process.env.ZEPHYRA_PUBLIC_URL;
});

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("boundaries §5 row 7 — MercadoPago back_urls resolve to academia", () => {
  it("puts all three B2C back_urls on the academia host", async () => {
    const fetchMock = mockFetchOnce();
    await new MercadoPagoAdapter().createCheckoutSession(ORDER);
    const { back_urls } = bodyOf(fetchMock);

    expect(back_urls.success).toBe(
      `${ACADEMIA}/cursos/sostenibilidad-101/compra/exito?orderId=lmsOrders-abc`
    );
    expect(back_urls.failure).toBe(
      `${ACADEMIA}/cursos/sostenibilidad-101/compra/error?orderId=lmsOrders-abc`
    );
    expect(back_urls.pending).toBe(
      `${ACADEMIA}/cursos/sostenibilidad-101/compra/pendiente?orderId=lmsOrders-abc`
    );

    for (const url of Object.values(back_urls)) {
      expect(new URL(url).origin).toBe(ACADEMIA);
      // `startsWith(APEX)` rather than `!toContain`: the academia host does not
      // contain the apex string, but a bare apex URL would start with it.
      expect(url.startsWith(APEX)).toBe(false);
    }
  });

  it("puts the B2B pack back_urls (/empresa/compra/*) on the academia host", async () => {
    const fetchMock = mockFetchOnce();
    await new MercadoPagoAdapter().createCheckoutSession({
      ...ORDER,
      orderId: "lmsOrders-pack",
      returnBase: "/empresa/compra",
    });
    const { back_urls } = bodyOf(fetchMock);

    expect(back_urls.success).toBe(
      `${ACADEMIA}/empresa/compra/exito?orderId=lmsOrders-pack`
    );
    expect(new URL(back_urls.failure).origin).toBe(ACADEMIA);
    expect(new URL(back_urls.pending).origin).toBe(ACADEMIA);
    // /empresa/* has NO 301 rule. The apex here is unrecoverable.
    for (const url of Object.values(back_urls)) {
      expect(url.startsWith(APEX)).toBe(false);
    }
  });

  it("keeps notification_url on the Convex HTTP endpoint, NOT on academia", async () => {
    const fetchMock = mockFetchOnce();
    await new MercadoPagoAdapter().createCheckoutSession(ORDER);
    const { notification_url } = bodyOf(fetchMock);

    expect(notification_url).toBe(`${CONVEX_SITE}/api/lms/mp/webhook`);
    expect(notification_url.startsWith(ACADEMIA)).toBe(false);
    expect(notification_url.startsWith(APEX)).toBe(false);
  });

  it("refuses to construct at all when academia's origin is unset", async () => {
    // Fail-fast placement: the constructor throws BEFORE the preference exists,
    // so a misconfigured deployment cannot charge a buyer against a broken
    // callback. The pre-M4 code silently used the apex here.
    delete process.env.ZEPHYRA_ACADEMIA_URL;
    expect(() => new MercadoPagoAdapter()).toThrow(/ZEPHYRA_ACADEMIA_URL/);
  });

  it("refuses to construct when the Convex HTTP origin cannot be resolved", async () => {
    // The removed third fallback was `this.siteUrl` — the Next.js app, which
    // serves no webhook route. That would have meant: no payment ever processed,
    // with no error anywhere.
    delete process.env.CONVEX_SITE_URL;
    delete process.env.CONVEX_CLOUD_URL;
    expect(() => new MercadoPagoAdapter()).toThrow(
      /neither CONVEX_SITE_URL nor CONVEX_CLOUD_URL/
    );
  });

  it("derives the webhook origin from CONVEX_CLOUD_URL when CONVEX_SITE_URL is absent", async () => {
    // Positive control for the test above: proves the throw is caused by the
    // absence of BOTH vars, not by the harness dropping env vars generally.
    delete process.env.CONVEX_SITE_URL;
    process.env.CONVEX_CLOUD_URL = "https://corgi-88.convex.cloud";
    const fetchMock = mockFetchOnce();
    await new MercadoPagoAdapter().createCheckoutSession(ORDER);
    expect(bodyOf(fetchMock).notification_url).toBe(
      `${CONVEX_SITE}/api/lms/mp/webhook`
    );
  });
});
