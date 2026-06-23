# API Contract: Zephyra LMS — Sprint 3a Phase B (Sales Pack money-path core)

**Date**: 2026-06-23
**Branch**: `feature/010-zephyra-lms-packs`
**Convex dev deploy**: `dev:exuberant-corgi-88`
**Status**: **CONTRACT** — the frontend binds to the function names + arg/return
shapes below. The frontend does NOT read the backend implementation; this doc is
the boundary. Backed by the frozen schema contract
(`data-model-sprint-3a-packs.md`) and the Sprint-2 money-path spine.

This contract covers the B2B seat-pack purchase path: org sign-up, server-
authoritative pack pricing, and the org-owner-gated pack checkout. Seat
claiming / roster (Phase 3b) is NOT in this contract.

---

## Trust boundary (READ FIRST)

All org-scoped functions take a `callerCustomerId: Id<"lmsCustomers">`. This is
the **cookie-derived identity**: the Next.js server-action layer validates the
`session-learner` cookie via `getLearnerSession()` and passes the resulting
customer id. Convex cannot read cookies, so this is a trusted boundary input —
the SAME pattern as the Sprint-2 `createCheckout({ learnerId })` and
`setLearnerPassword({ learnerId })`. The backend then asserts (via
`requireOrgOwner`) that this identity actually OWNS the target org, so a forged
`callerCustomerId` can only ever act on an org the attacker already owns.

**The client NEVER sends a price.** Pricing is recomputed server-side on every
quote and every checkout. Any price the client computes is display-only.

---

## 1. Org sign-up (B0)

Self-service org sign-up is a **two-step** flow mirroring the B2C learner
activation: (1) verify email control via the existing magic link, then (2)
create the org. The frontend orchestrates both steps.

### Step 1 — verify email (REUSE the existing magic-link functions)
- `requestMagicLink({ email, purpose: "learner_activation", fromIp? })`
  → `{ rawToken: string | null, expiresAt: number | null, alreadyActivated: boolean }`
  (mutation — `convex/lms/auth.ts`). The server action emails the link.
- `consumeMagicLink({ token, purpose: "learner_activation" })`
  → `{ customer: { _id, email, type, activatedAt?, organizationId? } }`
  (mutation — `convex/lms/auth.ts`). Creates/activates the `lmsCustomers` row.
  The returned `customer._id` is the **verified `ownerCustomerId`** for Step 2.

### Step 2 — create the organization
- **`createOrganization`** — `mutation` — `convex/lms/org.ts`
  - **Args:** `{ ownerCustomerId: Id<"lmsCustomers">, name: string, taxId?: string }`
  - **Returns:** `{ organizationId: Id<"lmsOrganizations">, ownerCustomerId: Id<"lmsCustomers">, alreadyExisted: boolean }`
  - **Auth:** the `ownerCustomerId` must be a verified (activated) customer — the
    magic-link consume IS the proof of email control (no admin gate; this is the
    org-owner boundary).
  - **Effect:** promotes the customer to `type: "org_admin"`, stamps
    `organizationId`, and creates the single `lmsOrganizations` row. The Owner
    Admin does **not** consume a seat.
  - **Edge cases:**
    - Idempotent: a re-submit for a customer who already owns an org returns the
      existing org with `alreadyExisted: true` (no second org).
    - `verificá tu email antes de crear la organización` — thrown if the customer
      is not yet activated.
    - `el nombre de la organización es obligatorio` — empty/blank `name`.

### Reading the org back
- **`getOrganizationByOwner`** — `query` — `convex/lms/org.ts`
  - **Args:** `{ callerCustomerId: Id<"lmsCustomers"> }`
  - **Returns:** `{ _id, name, taxId?, ownerCustomerId, createdAt } | null`
  - **Auth:** self-scoped — only ever returns the org the caller owns (use this
    to route an owner to their console after sign-in).
- **`getMyOrganization`** — `query` — `convex/lms/org.ts`
  - **Args:** `{ callerCustomerId: Id<"lmsCustomers">, organizationId: Id<"lmsOrganizations"> }`
  - **Returns:** `{ _id, name, taxId?, ownerCustomerId, createdAt }`
  - **Auth:** `requireOrgOwner` — throws `no autorizado` if the caller is not the
    org's owner (cross-org isolation).

---

## 2. Pack price calculation (B1) — server-authoritative

- **`computePackPrice`** — `query` — `convex/lms/packs.ts`
  - **Args:** `{ courseId: Id<"lmsCourses">, seatCount: number }`
  - **Returns (discriminated):**
    - Available:
      ```ts
      {
        available: true,
        courseId: Id<"lmsCourses">,
        courseTitle: string,
        seatCount: number,
        unitPriceUsd: number,        // per-seat LIST price (before discount)
        appliedDiscountPct: number,  // 0 | 10 | 20 | (50+ band)
        totalPriceUsd: number,       // seatCount × unitPriceUsd × (1 − pct/100)
        selfCheckoutAllowed: boolean // false ⇒ show "Contactanos"
      }
      ```
    - Not available: `{ available: false, reason: string }`
      (`reason` ∈ `course_not_available | seat_count_invalid | course_not_priced | no_matching_tier`)
  - **Auth:** none (pricing only exposes already-public course-price math; the
    PURCHASE is gated separately).
  - **Volume bands (config-driven, server is the authority):**
    | seats | discount | selfCheckout |
    |-------|----------|--------------|
    | 1–9   | 0%       | true |
    | 10–24 | 10%      | true |
    | 25–49 | 20%      | true |
    | 50+   | custom   | **false → "Contactanos"** |
  - **Edge cases for the UI:**
    - `selfCheckoutAllowed: false` (50+) → render the "Contactanos" CTA, NOT a
      checkout button. (Checkout will also reject this band — see §3.)
    - `available: false` → no price; show the appropriate message per `reason`.
    - The UI may display `totalPriceUsd`, but it is **never** sent to checkout —
      checkout recomputes it.

---

## 3. Pack checkout (B2) — org-owner-gated

- **`createPackCheckout`** — `action` — `convex/lms/payment/checkout.ts`
  - **Args:** `{ callerCustomerId: Id<"lmsCustomers">, organizationId: Id<"lmsOrganizations">, courseId: Id<"lmsCourses">, seatCount: number }`
    — **NO price arg by design.**
  - **Returns:** `{ redirectUrl: string, orderId: Id<"lmsOrders"> }`
    - `redirectUrl` = MercadoPago Checkout Pro `init_point` (redirect the buyer here).
    - `orderId` = the pack order; use it to read the return-page status.
  - **Auth:** `requireOrgOwner` — the caller MUST be the org's owner.
  - **Effect:** recomputes the price server-side, snapshots a `pending_payment`
    pack order (`orderType: "pack"` + the server pricing), and opens an MP
    preference in USD.
  - **Edge cases (all surface as a thrown Error the UI catches):**
    - **50+ reject:** `Para 50 o más seats, contactanos…` — the
      `selfCheckoutAllowed: false` band cannot self-checkout (defense-in-depth
      with §2).
    - **Invalid seatCount:** `Cantidad de seats inválida: <reason>`.
    - **Course not purchasable:** `Curso no disponible para compra`.
    - **Not the owner:** `no autorizado` (from `requireOrgOwner`).
    - **Retry-reuse:** calling again for the SAME `(organizationId, courseId)`
      while an order is still `pending_payment` REUSES that order (same
      `orderId`) instead of creating a duplicate — safe to call on a back-click.

### Return-page status read (REUSE the Sprint-2 function)
- `getOrderById({ orderId })` — `query` — `convex/lms/payment/orders.ts`
  → `{ _id, courseId, status, priceUsd } | null`.
  The `/compra/{exito|error|pendiente}` pages read REAL order status from here
  (DB is truth; the MP back_url path is only a UX hint). `status` advances to
  `paid` only on the authoritative webhook. For a pack order, `paid` means the
  seat pack has been minted server-side (the org owner then claims seats — 3b).

---

## What the frontend MUST NOT do

- Never send a price, discount, or total to any function — the server is the
  only pricing authority.
- Never call a mint/seat/order-creation function directly — seats and pack
  orders are minted only by the gated checkout action + the webhook
  (internal-only mutations; not exposed to the client).
- Never derive entitlement from the MP back_url query string — read order status
  via `getOrderById`.

---

## Tampering / abuse handling (already enforced server-side)

- **Forged price/seatCount:** ignored. `createPackCheckout` recomputes the total
  from the course list price × the configured tier; the order carries the SERVER
  total, and the webhook validates the settled amount against it before approving.
  An underpay/forged amount is rejected (no pack minted, no entitlement).
- **Cross-org access:** `requireOrgOwner` rejects any caller who is not the
  target org's owner on every org-scoped function.
- **Duplicate/replayed approved webhook:** mints exactly ONE seat pack + exactly
  `seatCount` seats (idempotent on the order). The frontend sees a single `paid`
  order either way.
