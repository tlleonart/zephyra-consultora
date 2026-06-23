# ADR-0016 — Privacy enforcement: server-side nominal gate (Habeas Data)

- **Status:** Accepted (2026-06-23)
- **Sprint:** SPRINT-ZEPHYRA-LMS-3b (privacy-aware reporting + learner consent)
- **Spec:** `specs/008-zephyra-lms-foundation/`
- **Branch:** `feature/010-zephyra-lms-packs`
- **Contracts:** `api-contract-sprint-3b.md`, `data-model-sprint-3a-packs.md`

## Context

An org admin needs to see how their team is progressing, but per-person
(nominal) progress is personal data under Argentina's Habeas Data / Ley 25.326.
The admin paid for the seats, which creates pressure to expose nominal progress
by default. We had to decide where the privacy boundary is enforced and what the
default is — and crucially, whether the gate is a UI affordance or a hard
server-side denial.

## Decision

1. **Default is OPT-OUT.** A learner shares nothing nominal until they explicitly
   grant. `getMyConsentState` returns `[]` (no rows) for a fresh learner, which
   the UI renders honestly as "no autorizado". Consent rows live in
   `lmsProgressConsents` (indexed `by_learner_org`); grant/revoke are
   audit-bearing upserts (the row is never deleted — a revoke stamps `revokedAt`).
   Consent is either org-wide (`courseId` undefined) or course-scoped.

2. **The nominal gate is SERVER-SIDE, not UI-hidden.** `getNominalProgress`
   (org-owner-gated) additionally **throws** `acceso denegado: el learner no
   consintió compartir su progreso nominal` unless a `granted: true` consent row
   exists for the (learner, org) pair (accepting an org-wide consent OR one scoped
   to the course). The nominal data never leaves the server without consent. This
   is the load-bearing decision: a privacy gate that lives only in the UI is not a
   privacy gate. The Habeas-Data severity demands the data not cross the wire.

3. **Three reporting tiers with distinct boundaries.**
   - `getOrgSeatPacks` — pure Access-side capacity read (`by_organization`); no
     identity, no progress, no consent gate.
   - `getOrgRoster` — membership (display email only); **membership ≠ progress**,
     so no progress/score is ever returned here.
   - `getOrgCourseProgress` — the ONLY path crossing Access × Learning, and it
     emits **aggregate-only** counts (completed / inProgress / notStarted /
     avgProgressPercent) with NO learner id or per-person row.
   - `getNominalProgress` — the only per-person progress path, and it is
     consent-gated as in point 2.

4. **The frontend never reconstructs nominal data.** The dashboard DEFAULT is the
   aggregate view. The per-learner drill-down calls `getNominalProgress` and maps
   the thrown denial to a "sin consentimiento — solo agregado" state — it never
   assembles nominal progress from the roster + aggregate as a workaround (the
   contract's "What the frontend MUST NOT do" is explicit on this). The learner
   controls consent from `/cursos/privacidad` (grant/revoke), reachable from the
   player.

## Consequences

- **Positive.** The privacy boundary is enforced where the data lives (the Convex
  function), not in a hideable client. The admin gets useful aggregate insight by
  default and nominal detail only with explicit, revocable, audited consent —
  defensible under Habeas Data.
- **Negative / deferred.** The admin cannot see who specifically is lagging unless
  that person consents; this is by design (and a feature, not a gap). Course-
  scoped consent is supported by the backend but the learner UI exposes only the
  org-wide toggle in V1 (additive to expose per-course later).
- **For the frontend.** The "Ver progreso" drill-down must treat the denial as an
  EXPECTED branch (`consented: false`), not an error; the aggregate dashboard is
  always available without any consent.
