/**
 * Unit tests for the buyer confirmation email (Sprint 2 Phase P1.6).
 *
 * Two surfaces:
 *  (A) sendBuyerConfirmationEmail (the "use node" internalAction) — template
 *      renders, mail is sent via the (mocked) nodemailer transport, dev
 *      fallback when EMAIL_USER is absent, missing-learner is a logged no-op,
 *      and a transport failure is swallowed (never throws).
 *  (B) processVerifiedPayment scheduling — the email is SCHEDULED exactly once
 *      on the approved branch, and is NOT scheduled on rejected nor on a
 *      duplicate (already_processed) webhook. This is the idempotency claim:
 *      "dup webhook = no dup email".
 *
 * Convention (matches paymentProcessing.test.ts): pure-handler-with-mock-ctx;
 * the generated `api`/`internal` refs are stubbed so ctx.runQuery/runMutation/
 * scheduler.runAfter carry a name our mock can dispatch/record on.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// --- nodemailer: capture sendMail calls -------------------------------------
// vi.mock is hoisted above top-level consts, so the spies are created via
// vi.hoisted (which is also hoisted) and referenced from the factory.
const { sendMailMock, createTransportMock } = vi.hoisted(() => {
  // Typed via the generic so mock.calls[0][0] is the mail options object, not
  // the empty tuple `[]` (which would make the cast a TS2493 out-of-range read).
  const sendMailMock =
    vi.fn<(opts: Record<string, unknown>) => Promise<{ messageId: string }>>(
      async () => ({ messageId: "mock" })
    );
  const createTransportMock = vi.fn(() => ({ sendMail: sendMailMock }));
  return { sendMailMock, createTransportMock };
});
vi.mock("nodemailer", () => ({
  createTransport: createTransportMock,
}));

// --- generated api/internal stubs (opaque refs at runtime) ------------------
vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    lms: { auth: { getLearnerById: { __name: "getLearnerById" } } },
  },
  internal: {
    lms: {
      enrollments: {
        grantEnrollmentForOrder: { __name: "grantEnrollmentForOrder" },
      },
      payment: {
        ledger: { recordRevenueShare: { __name: "recordRevenueShare" } },
        email: {
          sendBuyerConfirmationEmail: {
            __name: "sendBuyerConfirmationEmail",
          },
        },
      },
    },
  },
}));

// Imported AFTER the mocks above are registered.
import { sendBuyerConfirmationEmail } from "../../../../convex/lms/payment/email";
import { processVerifiedPayment } from "../../../../convex/lms/payment/internal";
import { grantEnrollmentForOrder } from "../../../../convex/lms/enrollments";
import { recordRevenueShare } from "../../../../convex/lms/payment/ledger";

/* eslint-disable @typescript-eslint/no-explicit-any */
const emailHandler = (sendBuyerConfirmationEmail as any)._handler as (
  ctx: any,
  args: any
) => Promise<void>;
const processHandler = (processVerifiedPayment as any)._handler as (
  ctx: any,
  args: any
) => Promise<any>;
const grantHandler = (grantEnrollmentForOrder as any)._handler as (
  ctx: any,
  args: any
) => Promise<any>;
const ledgerHandler = (recordRevenueShare as any)._handler as (
  ctx: any,
  args: any
) => Promise<any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

const LEARNER = {
  _id: "lmsCustomers-1",
  email: "buyer@example.com",
  type: "individual" as const,
};

const EMAIL_ARGS = {
  learnerId: "lmsCustomers-1",
  enrollmentId: "lmsEnrollments-1",
  courseTitle: "Diversidad, Equidad e Inclusión",
  courseSlug: "diversidad-equidad-inclusion",
};

// Mock ctx for the action: ctx.runQuery resolves the learner.
function makeActionCtx(learner: unknown = LEARNER) {
  return {
    runQuery: vi.fn(async (ref: { __name: string }) => {
      if (ref.__name === "getLearnerById") return learner;
      throw new Error(`unexpected runQuery ref: ${ref.__name}`);
    }),
  };
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

// ============================================================================
// (A) sendBuyerConfirmationEmail — the action
// ============================================================================
describe("sendBuyerConfirmationEmail — send path (EMAIL_USER set)", () => {
  beforeEach(() => {
    process.env.EMAIL_USER = "no-reply@zephyraconsultora.com";
    process.env.EMAIL_PASSWORD = "secret";
    process.env.NEXT_PUBLIC_SITE_URL = "https://zephyraconsultora.com";
  });

  it("renders the template and sends via the Ferozo transport", async () => {
    await emailHandler(makeActionCtx(), EMAIL_ARGS);

    expect(createTransportMock).toHaveBeenCalledTimes(1);
    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({ host: "c2810738.ferozo.com", port: 465, secure: true })
    );
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    const mail = sendMailMock.mock.calls[0][0] as unknown as {
      from: string;
      to: string;
      subject: string;
      html: string;
      text: string;
    };
    expect(mail.to).toBe("buyer@example.com");
    expect(mail.from).toContain("Zephyra Consultora");
    expect(mail.subject).toBe(
      "Compra confirmada: Diversidad, Equidad e Inclusión"
    );
    // Template carries the course title + a player link keyed on SLUG.
    expect(mail.html).toContain("Diversidad, Equidad e Inclusión");
    expect(mail.html).toContain(
      "https://zephyraconsultora.com/cursos/diversidad-equidad-inclusion/player"
    );
    expect(mail.html).toContain("Compra confirmada");
    // Plain-text alternative present.
    expect(mail.text).toContain("ha sido confirmada");
  });

  it("falls back to ZEPHYRA_PUBLIC_URL, then the prod host, for the player link", async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.ZEPHYRA_PUBLIC_URL = "https://staging.zephyra.test";
    await emailHandler(makeActionCtx(), EMAIL_ARGS);
    const mail = sendMailMock.mock.calls[0][0] as unknown as { html: string };
    expect(mail.html).toContain(
      "https://staging.zephyra.test/cursos/diversidad-equidad-inclusion/player"
    );
  });

  it("escapes HTML in the course title (no injection via title)", async () => {
    await emailHandler(makeActionCtx(), {
      ...EMAIL_ARGS,
      courseTitle: '<script>alert("x")</script>',
    });
    const mail = sendMailMock.mock.calls[0][0] as unknown as { html: string };
    expect(mail.html).not.toContain("<script>alert");
    expect(mail.html).toContain("&lt;script&gt;");
  });

  it("swallows a transport failure (logs, does not throw)", async () => {
    sendMailMock.mockRejectedValueOnce(new Error("smtp down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(emailHandler(makeActionCtx(), EMAIL_ARGS)).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

describe("sendBuyerConfirmationEmail — dev fallback + edge cases", () => {
  it("dev fallback: no EMAIL_USER ⇒ logs, never constructs a transport", async () => {
    delete process.env.EMAIL_USER;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await emailHandler(makeActionCtx(), EMAIL_ARGS);
    expect(createTransportMock).not.toHaveBeenCalled();
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("missing learner ⇒ logged no-op (no send)", async () => {
    process.env.EMAIL_USER = "no-reply@zephyraconsultora.com";
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await emailHandler(makeActionCtx(null), EMAIL_ARGS);
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

// ============================================================================
// (B) processVerifiedPayment scheduling — dup webhook = no dup email
// ============================================================================
interface Row {
  _id: string;
  [k: string]: unknown;
}

function makeStore(seed: { orders?: Row[]; courses?: Row[] } = {}) {
  const tables: Record<string, Row[]> = {
    lmsOrders: [...(seed.orders ?? [])],
    lmsCourses: [...(seed.courses ?? [])],
    lmsPayments: [],
    lmsEnrollments: [],
    lmsRevenueShares: [],
  };
  let seq = 0;
  const scheduled: Array<{ ref: string; args: unknown }> = [];

  const db = {
    get: vi.fn(async (id: string) => {
      for (const t of Object.values(tables)) {
        const found = t.find((r) => r._id === id);
        if (found) return found;
      }
      return null;
    }),
    insert: vi.fn(async (table: string, row: Record<string, unknown>) => {
      seq += 1;
      const _id = `${table}-${seq}`;
      tables[table] = tables[table] ?? [];
      tables[table].push({ _id, ...row });
      return _id;
    }),
    patch: vi.fn(async (id: string, patch: Record<string, unknown>) => {
      for (const t of Object.values(tables)) {
        const found = t.find((r) => r._id === id);
        if (found) Object.assign(found, patch);
      }
    }),
    query: vi.fn((table: string) => {
      const eqs: Array<[string, unknown]> = [];
      const chain = {
        withIndex: (
          _name: string,
          builder: (q: { eq: (f: string, v: unknown) => unknown }) => unknown
        ) => {
          const q = {
            eq: (f: string, v: unknown) => {
              eqs.push([f, v]);
              return q;
            },
          };
          builder(q);
          return chain;
        },
        first: async () => {
          const rows = tables[table] ?? [];
          const match = rows.find((r) => eqs.every(([f, v]) => r[f] === v));
          return match ?? null;
        },
      };
      return chain;
    }),
  };

  const ctx = {
    db,
    runMutation: vi.fn(async (ref: { __name: string }, args: unknown) => {
      if (ref.__name === "grantEnrollmentForOrder") return grantHandler(ctx, args);
      if (ref.__name === "recordRevenueShare") return ledgerHandler(ctx, args);
      throw new Error(`unexpected runMutation ref: ${ref.__name}`);
    }),
    scheduler: {
      runAfter: vi.fn(async (_delay: number, ref: { __name: string }, args: unknown) => {
        scheduled.push({ ref: ref.__name, args });
      }),
    },
  };

  return { ctx, tables, scheduled };
}

const ORDER: Row = {
  _id: "lmsOrders-seed",
  customerId: "lmsCustomers-1",
  courseId: "lmsCourses-seed",
  priceUsd: 90,
  status: "pending_payment",
  externalReference: "lmsOrders-seed",
  createdAt: 1,
  updatedAt: 1,
};
const COURSE: Row = {
  _id: "lmsCourses-seed",
  title: "Diversidad, Equidad e Inclusión",
  slug: "diversidad-equidad-inclusion",
  status: "published",
};

const approvedFetched = (id = "mp-email-1") => ({
  id,
  status: "approved" as const,
  amount: 16200,
  currency: "ARS",
  external_reference: "lmsOrders-seed",
  feeDetails: [{ type: "mercadopago_fee", amount: 100 }],
});

describe("processVerifiedPayment — schedules buyer email on approval", () => {
  it("schedules exactly one email with the resolved title + slug", async () => {
    const { ctx, scheduled } = makeStore({
      orders: [{ ...ORDER }],
      courses: [{ ...COURSE }],
    });
    const res = await processHandler(ctx, {
      fetched: approvedFetched(),
      priorEvents: [],
    });
    expect(res.outcome).toBe("approved");
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].ref).toBe("sendBuyerConfirmationEmail");
    expect(scheduled[0].args).toMatchObject({
      learnerId: "lmsCustomers-1",
      enrollmentId: res.enrollmentId,
      courseTitle: "Diversidad, Equidad e Inclusión",
      courseSlug: "diversidad-equidad-inclusion",
    });
  });

  it("dup webhook ⇒ NO second email (already_processed short-circuits)", async () => {
    const { ctx, scheduled } = makeStore({
      orders: [{ ...ORDER }],
      courses: [{ ...COURSE }],
    });
    const first = await processHandler(ctx, { fetched: approvedFetched(), priorEvents: [] });
    const second = await processHandler(ctx, { fetched: approvedFetched(), priorEvents: [] });
    expect(first.outcome).toBe("approved");
    expect(second.outcome).toBe("already_processed");
    // The load-bearing claim: one approval ⇒ one email, even on replay.
    expect(scheduled).toHaveLength(1);
  });

  it("rejected payment ⇒ no email scheduled", async () => {
    const { ctx, scheduled } = makeStore({
      orders: [{ ...ORDER }],
      courses: [{ ...COURSE }],
    });
    const res = await processHandler(ctx, {
      fetched: { ...approvedFetched("mp-rej"), status: "rejected" as const },
      priorEvents: [],
    });
    expect(res.outcome).toBe("rejected");
    expect(scheduled).toHaveLength(0);
  });

  it("approved but course missing ⇒ enrollment stands, no email (best-effort)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { ctx, tables, scheduled } = makeStore({
      orders: [{ ...ORDER }],
      courses: [], // course row gone
    });
    const res = await processHandler(ctx, { fetched: approvedFetched(), priorEvents: [] });
    expect(res.outcome).toBe("approved");
    expect(tables.lmsEnrollments).toHaveLength(1); // money path intact
    expect(scheduled).toHaveLength(0); // email skipped
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
