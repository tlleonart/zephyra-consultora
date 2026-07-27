/**
 * Unit tests for MercadoPagoAdapter.createCheckoutSession (Sprint 2 P1.1).
 *
 * The adapter does outbound HTTP + reads env; we mock global.fetch + the MP
 * env credentials so the preference-creation logic is exercised without a live
 * MP call (the sandbox e2e at sprint-close hits the real API). We assert:
 *  - POST hits /checkout/preferences with the bearer token
 *  - body is priced in USD with external_reference = our orderId
 *  - back_urls land on the public site /cursos/{slug}/compra/... with orderId
 *  - notification_url targets the Convex webhook (.convex.site), not the app
 *  - auto_return = "approved"
 *  - returns { externalId: preference.id, redirectUrl: init_point }
 *  - non-2xx + missing-fields responses throw
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MercadoPagoAdapter } from "../../../../convex/lms/payment/mercadopago";

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

beforeEach(() => {
  process.env.MP_ACCESS_TOKEN = "test-access-token";
  process.env.MP_WEBHOOK_SECRET = "test-webhook-secret";
  process.env.MP_PUBLIC_KEY = "test-public-key";
  process.env.ZEPHYRA_PUBLIC_URL = "https://zephyra.test";
  process.env.CONVEX_SITE_URL = "https://corgi-88.convex.site";
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockFetchOnce(response: {
  ok: boolean;
  status?: number;
  statusText?: string;
  json?: unknown;
}) {
  const fetchMock = vi.fn(async () => ({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 400),
    statusText: response.statusText ?? "",
    json: async () => response.json ?? {},
  }));
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("createCheckoutSession — happy path", () => {
  it("POSTs a USD preference and returns id + init_point", async () => {
    const fetchMock = mockFetchOnce({
      ok: true,
      json: {
        id: "pref-123",
        init_point: "https://mp.com/checkout/pref-123",
        sandbox_init_point: "https://sandbox.mp.com/checkout/pref-123",
      },
    });

    const adapter = new MercadoPagoAdapter();
    const result = await adapter.createCheckoutSession(ORDER);

    expect(result).toEqual({
      externalId: "pref-123",
      redirectUrl: "https://mp.com/checkout/pref-123",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.mercadopago.com/checkout/preferences");
    expect(init.method).toBe("POST");
    expect(
      (init.headers as Record<string, string>).Authorization
    ).toBe("Bearer test-access-token");

    const body = JSON.parse(init.body as string);
    expect(body.items[0]).toMatchObject({
      id: ORDER.courseId,
      title: ORDER.courseTitle,
      quantity: 1,
      currency_id: "USD",
      unit_price: 90,
    });
    expect(body.payer.email).toBe("learner@example.com");
    expect(body.external_reference).toBe("lmsOrders-abc");
    expect(body.auto_return).toBe("approved");
  });

  it("builds back_urls on the public site with the orderId and the slug routes", async () => {
    const fetchMock = mockFetchOnce({
      ok: true,
      json: { id: "pref-1", init_point: "https://mp.com/x" },
    });
    const adapter = new MercadoPagoAdapter();
    await adapter.createCheckoutSession(ORDER);

    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    const body = JSON.parse(init.body as string);
    expect(body.back_urls.success).toBe(
      "https://zephyra.test/cursos/sostenibilidad-101/compra/exito?orderId=lmsOrders-abc"
    );
    expect(body.back_urls.failure).toBe(
      "https://zephyra.test/cursos/sostenibilidad-101/compra/error?orderId=lmsOrders-abc"
    );
    expect(body.back_urls.pending).toBe(
      "https://zephyra.test/cursos/sostenibilidad-101/compra/pendiente?orderId=lmsOrders-abc"
    );
  });

  it("routes a pack order's back_urls to /empresa/compra (returnBase), not the B2C course route", async () => {
    const fetchMock = mockFetchOnce({
      ok: true,
      json: { id: "pref-pack", init_point: "https://mp.com/pack" },
    });
    const adapter = new MercadoPagoAdapter();
    // The pack flow (createPackCheckout) passes returnBase: "/empresa/compra".
    await adapter.createCheckoutSession({
      ...ORDER,
      orderId: "lmsOrders-pack",
      returnBase: "/empresa/compra",
    });

    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    const body = JSON.parse(init.body as string);
    expect(body.back_urls.success).toBe(
      "https://zephyra.test/empresa/compra/exito?orderId=lmsOrders-pack"
    );
    expect(body.back_urls.failure).toBe(
      "https://zephyra.test/empresa/compra/error?orderId=lmsOrders-pack"
    );
    expect(body.back_urls.pending).toBe(
      "https://zephyra.test/empresa/compra/pendiente?orderId=lmsOrders-pack"
    );
    // The B2C course slug must NOT appear in a pack order's back_urls.
    expect(body.back_urls.success).not.toContain("/cursos/");
  });

  it("keeps the B2C default course route when returnBase is absent", async () => {
    const fetchMock = mockFetchOnce({
      ok: true,
      json: { id: "pref-b2c", init_point: "https://mp.com/b2c" },
    });
    const adapter = new MercadoPagoAdapter();
    // No returnBase ⇒ unchanged B2C behavior.
    await adapter.createCheckoutSession(ORDER);

    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    const body = JSON.parse(init.body as string);
    expect(body.back_urls.success).toBe(
      "https://zephyra.test/cursos/sostenibilidad-101/compra/exito?orderId=lmsOrders-abc"
    );
    expect(body.back_urls.success).not.toContain("/empresa/compra");
  });

  it("points notification_url at the Convex webhook (.convex.site), not the app", async () => {
    const fetchMock = mockFetchOnce({
      ok: true,
      json: { id: "pref-1", init_point: "https://mp.com/x" },
    });
    const adapter = new MercadoPagoAdapter();
    await adapter.createCheckoutSession(ORDER);

    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    const body = JSON.parse(init.body as string);
    expect(body.notification_url).toBe(
      "https://corgi-88.convex.site/api/lms/mp/webhook"
    );
  });

  it("falls back to sandbox_init_point when init_point is absent", async () => {
    mockFetchOnce({
      ok: true,
      json: { id: "pref-9", sandbox_init_point: "https://sandbox.mp.com/y" },
    });
    const adapter = new MercadoPagoAdapter();
    const result = await adapter.createCheckoutSession(ORDER);
    expect(result.redirectUrl).toBe("https://sandbox.mp.com/y");
  });
});

describe("createCheckoutSession — failure modes", () => {
  it("throws on a non-2xx MP response", async () => {
    mockFetchOnce({ ok: false, status: 401, statusText: "Unauthorized" });
    const adapter = new MercadoPagoAdapter();
    await expect(adapter.createCheckoutSession(ORDER)).rejects.toThrow(
      /createCheckoutSession failed: 401/
    );
  });

  it("throws when the preference response is missing id/init_point", async () => {
    mockFetchOnce({ ok: true, json: { id: "pref-1" } }); // no init_point
    const adapter = new MercadoPagoAdapter();
    await expect(adapter.createCheckoutSession(ORDER)).rejects.toThrow(
      /missing id\/init_point/
    );
  });
});

describe("constructor — env discipline", () => {
  it("throws when MP credentials are missing", () => {
    delete process.env.MP_ACCESS_TOKEN;
    expect(() => new MercadoPagoAdapter()).toThrow(/Missing MP credentials/);
  });
});
