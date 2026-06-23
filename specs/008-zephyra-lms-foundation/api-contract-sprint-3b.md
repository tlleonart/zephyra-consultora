# API Contract: Zephyra LMS — Sprint 3b (Seat assignment + privacy reporting)

**Date**: 2026-06-23
**Branch**: `feature/010-zephyra-lms-packs`
**Convex dev deploy**: `dev:exuberant-corgi-88`
**Status**: **CONTRACT** — the frontend binds to the function names + arg/return
shapes below. The frontend does NOT read the backend implementation; this doc is
the boundary. Backed by the frozen schema contract
(`data-model-sprint-3a-packs.md`) and Phase B (`api-contract-sprint-3a-packs.md`).

This contract covers Phase C (seat invite + claim + release) and Phase D
(privacy-aware roster / aggregate / nominal reporting + learner consent). Phase B
(org sign-up, pack pricing, pack checkout, mint) is in the 3a contract and is the
precondition: a `paid` pack order has minted `lmsSeatPacks` + N available
`lmsSeats` server-side.

---

## Trust boundary (READ FIRST — same as 3a)

All org-scoped functions take `callerCustomerId: Id<"lmsCustomers">` — the
cookie-derived identity validated by the Next.js server-action layer
(`getLearnerSession()`). Convex cannot read cookies, so this is a trusted
boundary input; the backend asserts via `requireOrgOwner` that the identity owns
the target org (cross-org isolation). Learner-side consent functions take
`learnerCustomerId` derived the same way (self-scoped).

The seat **invite** is an opaque random token stored as HMAC-SHA-256 in
`lmsMagicLinkTokens` (the same discipline as the learner magic link), minted with
a DEDICATED purpose `seat_invite` (NOT the B2C `learner_activation`). The raw
token + a `claimRequestId` are returned ONCE. The token row is BOUND to its
`seatPackId` (a column on `lmsMagicLinkTokens`) and re-verified at claim time, so
an invitee cannot redeem against a different pack of the same org by editing the
URL. The `org` + `claimRequestId` context also travels in the invite URL the
frontend composes and is re-verified server-side at claim time.

**Purpose isolation:** a `seat_invite` token is claimable ONLY by `claimSeat`;
the B2C `consumeMagicLink` REJECTS it (it must not mint a B2C session), and
`claimSeat` REJECTS any B2C purpose token. The two surfaces never honor each
other's tokens.

> **Schema note (additive, this branch only):** `lmsMagicLinkTokens.purpose`
> gains a `v.literal("seat_invite")` and the table gains an optional
> `seatPackId: v.optional(v.id("lmsSeatPacks"))` column. Additive (the literal
> widens the union; the column is optional ⇒ all existing rows remain valid), so
> no backfill / migration is required.

---

## Phase C1 — Seat invite (org-owner-gated magic-link)

- **`requestSeatInvite`** — `mutation` — `convex/lms/seats.ts`
  - **Args:** `{ callerCustomerId: Id<"lmsCustomers">, organizationId: Id<"lmsOrganizations">, seatPackId: Id<"lmsSeatPacks">, employeeEmail: string }`
  - **Returns:**
    ```ts
    {
      rawToken: string | null,        // null when alreadyPending
      claimRequestId: string | null,  // null when alreadyPending
      expiresAt: number,              // ms epoch
      alreadyPending: boolean
    }
    ```
  - **Auth:** `requireOrgOwner` (caller must own the org; the pack must belong to it).
  - **Effect:** mints an invite token (purpose `seat_invite`, BOUND to
    `seatPackId` on the token row). Does NOT send the email — the server
    action composes the claim URL from `rawToken` + `claimRequestId` +
    `organizationId` + `seatPackId` and sends it (use the `SeatInvite` React Email
    template in `src/emails/SeatInvite.tsx` via `src/lib/mailer/learner.ts`
    `sendLearnerEmail`). TTL 7 days.
  - **Claim URL shape (frontend composes):**
    `${SITE_URL}/empresa/invitacion?token=<rawToken>&cr=<claimRequestId>&org=<organizationId>&pack=<seatPackId>`
  - **Edge cases (thrown `Error` the UI catches):**
    - **Pack full:** `el pack no tiene asientos disponibles para invitar` — blocked
      when `availableSeats === 0` (don't invite into a full pack).
    - **Re-invite idempotency (scoped to (email, seatPackId)):** a second invite
      for the SAME email AND THE SAME pack while a pending (unused, unexpired)
      `seat_invite` token exists returns `alreadyPending: true` with
      `rawToken: null` — do NOT issue a new link; the prior one is still live. An
      invite to a DIFFERENT pack for the same email (or any B2C token) does NOT
      match and DOES issue a fresh token + email — a real second-pack invite is
      never swallowed.
    - **Not the owner / pack not in org:** `no autorizado`.
    - **Empty email:** `el email del empleado es obligatorio`.

---

## Phase C2 — Seat claim → enrollment (the invite-landing call)

- **`claimSeat`** — `mutation` — `convex/lms/seats.ts`
  - **Args:** `{ token: string, claimRequestId: string, organizationId: Id<"lmsOrganizations">, seatPackId: Id<"lmsSeatPacks">, employeeEmail: string }`
    — the four URL params + the email the landing page collects/confirms.
  - **Returns:**
    ```ts
    {
      seatId: Id<"lmsSeats">,
      enrollmentId: Id<"lmsEnrollments">,
      learnerId: Id<"lmsCustomers">,
      alreadyClaimed: boolean
    }
    ```
  - **Auth:** the token IS the proof of email control (no `requireOrgOwner` — the
    claimer is the invited employee, not the owner). The token's email must match
    `employeeEmail`.
  - **Effect (single transaction):** verifies + burns the invite token; resolves
    or CREATES the `lmsCustomers` (`type: "org_learner"`, `organizationId` set) on
    first touch; picks an available seat → `claimed` (`claimedBy`, `claimedAt`,
    `claimRequestId`); `availableSeats-- / claimedSeats++` (balance held); creates
    ONE `lmsEnrollments` (`seatId` set, `status: "active"`, `progressPercent: 0`).
    From here the learner gets the SAME player UX as B2C — gate the player on the
    learner session + `getMyEnrollment` exactly as B2C.
  - **Edge cases:**
    - **Replay (idempotent):** a second `claimSeat` with the SAME `claimRequestId`
      returns the EXISTING `seatId` + `enrollmentId` with `alreadyClaimed: true` —
      NO new seat, NO new enrollment (lookup-before-insert on
      `lmsSeats.by_claim_request`). Safe to retry on a flaky landing.
    - **Over-claim (no seats):** `no hay asientos disponibles en el pack` —
      rejected when the pack has no available seat; balance untouched.
    - **Enrollment dedup:** `el learner ya tiene una inscripción activa para este
      curso` — the learner already holds an active enrollment for the course.
    - **Burned token (non-replay):** `esta invitación ya fue usada` — the token was
      consumed by a DIFFERENT claimRequestId (a true second claim, not a retry).
    - **Invalid/expired token:** `invitación inválida o expirada` / `invitación
      expirada` / `invitación inválida para este email`.
    - **Cross-pack redemption (URL tamper):** `invitación inválida para este pack`
      — the token is bound to ONE `seatPackId`; the `pack` URL param must match
      the bound pack, else rejected (the token is NOT burned).
    - **Wrong purpose (B2C token):** `invitación inválida para esta operación` — a
      `learner_activation`/`signin`/`recovery` token is rejected by `claimSeat`.

---

## Phase C3 — Seat release (marcar baja — status change)

- **`releaseSeat`** — `mutation` — `convex/lms/seats.ts`
  - **Args:** `{ callerCustomerId: Id<"lmsCustomers">, organizationId: Id<"lmsOrganizations">, seatId: Id<"lmsSeats"> }`
  - **Returns:** `{ seatId: Id<"lmsSeats">, enrollmentId: Id<"lmsEnrollments">, released: true }`
  - **Auth:** `requireOrgOwner`.
  - **Effect:** seat `claimed → released` (returned to the pool, re-claimable),
    `availableSeats++ / claimedSeats--`; the enrollment is ENDED via a status
    change (`status: "expired"`, `seatId` detached). NOT a soft-delete — no
    `deletedBy` (the actor is an org_admin, not staff).
  - **Edge cases:**
    - **Release BLOCKED if started:** `no se puede liberar un asiento de un learner
      que ya comenzó el curso` — releasable ONLY at zero engagement on all three
      signals (`progressPercent === 0 && scoreRaw === undefined &&
      firstTouchedAt === undefined`). Surface this so the UI greys out the release
      action for any learner who has touched the course.
    - **Seat not claimed:** `el asiento no está reclamado`.
    - **Not the owner / seat not in org:** `no autorizado`.

---

## Phase D1 — Roster + aggregate reporting (privacy-aware)

- **`getOrgRoster`** — `query` — `convex/lms/seats.ts`
  - **Args:** `{ callerCustomerId: Id<"lmsCustomers">, organizationId: Id<"lmsOrganizations"> }`
  - **Returns:**
    ```ts
    { members: Array<{
        learnerId: Id<"lmsCustomers">,
        email: string,           // DISPLAY identity only — membership ≠ progress
        courseId: Id<"lmsCourses">,
        seatId: Id<"lmsSeats">,
        claimedAt?: number
    }> }
    ```
  - **Auth:** `requireOrgOwner`. Members = learners holding a CLAIMED seat in the
    org's packs. NO progress/score here — membership is not progress.

- **`getOrgSeatPacks`** — `query` — `convex/lms/seats.ts`
  - **Args:** `{ callerCustomerId: Id<"lmsCustomers">, organizationId: Id<"lmsOrganizations"> }`
  - **Returns:**
    ```ts
    { packs: Array<{
        seatPackId: Id<"lmsSeatPacks">,
        courseId: Id<"lmsCourses">,
        totalSeats: number,      // total
        claimedSeats: number,    // asignados
        availableSeats: number,  // disponibles
        createdAt: number
    }> }
    ```
  - **Auth:** `requireOrgOwner` (caller must own the org; cross-org isolation —
    only the caller-org's packs are returned).
  - **Effect:** PURE Access-side read over `lmsSeatPacks.by_organization` —
    capacity counts only. Crosses NO Learning/progress boundary and emits NO
    learner identity, so no consent/privacy gate applies (unlike
    `getOrgCourseProgress` / `getNominalProgress`). One row per minted pack.
  - **Use:** drives the dashboard pack cards (`total/asignados/disponibles`) and
    supplies the `seatPackId` that `requestSeatInvite` ("Asignar cupo") needs.
    Resolve course **titles** frontend-side via `api.lms.courses.listPublished`
    (join on `courseId`) — no new title query.
  - **Notes:** NO status filter — an `lmsSeatPacks` row only exists post-mint
    (the 3a money path writes it on a `paid` order), so every returned pack is a
    real, payable pack; there is no draft/unpaid pack state to hide.
  - **Edge cases:** **Not the owner:** `no autorizado`. **Org missing:**
    `organización no encontrada`. **No packs yet:** `{ packs: [] }`.

- **`getOrgCourseProgress`** — `query` — `convex/lms/seats.ts`
  - **Args:** `{ callerCustomerId: Id<"lmsCustomers">, organizationId: Id<"lmsOrganizations">, courseId?: Id<"lmsCourses"> }`
  - **Returns (AGGREGATE-ONLY — NEVER identities):**
    ```ts
    { courses: Array<{
        courseId: Id<"lmsCourses">,
        totalClaimed: number,
        completed: number,
        inProgress: number,
        notStarted: number,
        avgProgressPercent: number  // floor of the mean across claimed seats
    }> }
    ```
  - **Auth:** `requireOrgOwner`. The ONLY path crossing Access × Learning. No
    learner id, email, or per-person row ever leaves here. Use it for the org
    dashboard charts. `courseId` optional — omit for all the org's courses.

- **`getNominalProgress`** — `query` — `convex/lms/seats.ts`
  - **Args:** `{ callerCustomerId: Id<"lmsCustomers">, organizationId: Id<"lmsOrganizations">, learnerCustomerId: Id<"lmsCustomers">, courseId: Id<"lmsCourses"> }`
  - **Returns:**
    ```ts
    {
      learnerId: Id<"lmsCustomers">,
      email: string,
      courseId: Id<"lmsCourses">,
      enrollment: {
        status: string,
        progressPercent: number,
        scoreRaw?: number,
        lessonStatus?: string,
        firstTouchedAt?: number,
        updatedAt: number
      } | null
    }
    ```
  - **Auth:** `requireOrgOwner` **AND** the NOMINAL gate.
  - **NOMINAL GATE (Habeas Data — server-side denial):** throws `acceso denegado:
    el learner no consintió compartir su progreso nominal` unless an
    `lmsProgressConsents` row exists with `granted: true` for the (learner, org)
    pair — accepting an org-wide consent (`courseId` undefined) OR a consent scoped
    to this `courseId`. This is NOT UI-hidden; the data never leaves the server
    without consent. The UI MUST handle the thrown denial (e.g. show a "sin
    consentimiento" state) rather than expecting data.

---

## Phase D2 — Learner consent (opt-in)

- **`grantProgressConsent`** — `mutation` — `convex/lms/consent.ts`
  - **Args:** `{ learnerCustomerId: Id<"lmsCustomers">, organizationId: Id<"lmsOrganizations">, courseId?: Id<"lmsCourses"> }`
  - **Returns:** `{ consentId: Id<"lmsProgressConsents">, granted: true }`
  - **Auth:** learner-authenticated (cookie-derived `learnerCustomerId`).
  - **Effect:** upsert (one row per (learner, org, courseId) tuple) → `granted:
    true`, `grantedAt` stamped, `revokedAt` cleared. `courseId` undefined ⇒
    org-wide; present ⇒ course-scoped. Org-wide and course-scoped are distinct rows.

- **`revokeProgressConsent`** — `mutation` — `convex/lms/consent.ts`
  - **Args:** same as grant.
  - **Returns:** `{ consentId: Id<"lmsProgressConsents">, granted: false }`
  - **Effect:** upsert → `granted: false`, `revokedAt` stamped (audit-bearing — the
    row is never deleted). Revoking with no prior row records an explicit opt-out.

- **`getMyConsentState`** — `query` — `convex/lms/consent.ts`
  - **Args:** `{ learnerCustomerId: Id<"lmsCustomers">, organizationId: Id<"lmsOrganizations"> }`
  - **Returns:** `{ consents: Array<{ courseId?: Id<"lmsCourses">, granted: boolean, grantedAt?: number, revokedAt?: number }> }`
  - **Auth:** self-scoped. **Default = OPT-OUT** — an empty array means no consent
    anywhere (the learner shares nothing until they explicitly grant).

---

## What the frontend MUST NOT do

- Never read nominal progress except via `getNominalProgress` (it will throw
  without consent — never try to assemble nominal progress from the roster +
  aggregate as a workaround).
- Never call a seat/enrollment-mint function directly — seats are claimed only via
  the gated `claimSeat` (token-proof), and packs are minted only by the 3a webhook.
- Never derive the consent state from UI flags — the server is the authority; read
  `getMyConsentState` / handle the `getNominalProgress` denial.
- Never reuse a consumed invite link — `claimSeat` burns the token; a retry must
  use the SAME `claimRequestId` (idempotent replay), not a fresh claim.

---

## Tampering / abuse handling (already enforced server-side)

- **Forged `callerCustomerId`:** `requireOrgOwner` rejects any caller who is not
  the org's owner on every org-scoped function (invite, release, roster, aggregate,
  nominal). A forged id can only act on an org the attacker already owns.
- **Over-claim:** `claimSeat` rejects when the pack has no available seat; the
  pack balance (`availableSeats + claimedSeats ≤ totalSeats`) is held
  transactionally on every claim/release.
- **Replayed claim:** lookup-before-insert on `claimRequestId` ⇒ exactly one seat
  + one enrollment, forever.
- **Release of a started seat:** rejected by the zero-engagement gate.
- **Nominal read without consent:** denied at the function (Habeas Data).
