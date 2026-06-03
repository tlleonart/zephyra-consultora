# ADR-0004 — The LMS lives in `zephyra-consultora` as a feature track, not a separate repo

- **Status:** Accepted
- **Date:** 2026-06-03
- **Sprint:** SPRINT-ZEPHYRA-LMS-0 (`specs/008-zephyra-lms-foundation`)
- **Relates to:** [ADR-0001](./0001-extend-zephyra-consultora-with-lms.md)
  (which establishes *why* there is no separate repo). This ADR records *how* the
  LMS coexists safely inside the shared repository.

## Context

[ADR-0001](./0001-extend-zephyra-consultora-with-lms.md) decided that the LMS
extends the existing `zephyra-consultora` repository rather than living in its
own repo. That decision creates an obligation: the LMS and the institutional site
now share one codebase, one Convex schema, one auth system, and one deploy
pipeline. Without explicit conventions, LMS work could collide with — or
regress — the institutional site that is already in production.

This ADR records the conventions that keep the two tracks isolated within the
shared repository.

## Decision

**The LMS is a feature track inside `zephyra-consultora`, isolated by
convention rather than by repository boundary.** The isolation rules:

### 1. `lms*` namespace convention

Every Convex table introduced by the LMS is prefixed `lms*` so it never
collides with the institutional site's existing tables. As of Sprint 0:

- `lmsCourses` — ingested SCORM course metadata + the `scoFiles` path→`_storage`
  map.
- `lmsEnrollments` — the per-learner aggregate (progress, score, lesson status),
  projected from events.
- `lmsScormEvents` — the append-only, never-updated, never-deleted SCORM event
  audit trail.

The same `lms*` discipline extends to application routes (`/cursos` public,
`/admin/lms` admin) and to LMS function files, which live under `convex/lms/`,
separate from the institutional function files at `convex/` root. New LMS tables
in later sprints (e.g. `lmsCustomers`, `lmsSeatPacks`, `lmsOrders`) follow the
same prefix.

### 2. Soft-delete coupling note (`deletedBy: Id<"adminUsers">`)

The institutional site uses a soft-delete pattern: deletable tables carry an
optional `deletedBy` field typed `Id<"adminUsers">`. LMS tables that participate
in soft delete **reuse that exact pattern and that exact type** —
`deletedBy: v.optional(v.id("adminUsers"))` — rather than introducing a separate
deletion-actor concept. `lmsCourses` already carries this field in the Sprint 0
schema.

The coupling this creates, recorded deliberately: in V1 there is **no separate
learner-deletion actor**. A learner data-deletion request (Habeas Data / ARCO) is
processed by a Zephyra Admin, who appears as the `deletedBy` `adminUsers`
reference — there is no `lmsCustomers`-typed deleter. If a future sprint
introduces learner-initiated or operator-initiated deletion with a distinct
actor, the `deletedBy` type becomes a coupling point that must be revisited
(e.g. a union of admin/customer ids); until then, reusing `Id<"adminUsers">`
keeps the deletion model unified with the institutional site.

### 3. Additive, non-regressing changes only

Schema changes are additive. LMS UI lives behind its own route groups so the
institutional routes (`/`, `/blog`, `/proyectos`, `/contacto`, `/admin`) are
untouched. Regression discipline (verify the institutional site still builds and
runs before closing any phase) is documented in
`specs/008-zephyra-lms-foundation/quickstart.md` §5.

## Consequences

- **Positive:** one repo, one deploy, one auth system, one storage layer; LMS and
  institutional code coexist without collision; the soft-delete and auth models
  stay unified rather than forked.
- **Constraint:** discipline is enforced by convention, not by a hard boundary —
  reviewers must check that new LMS tables/routes/functions keep the `lms*`
  prefix and the route-group separation, and that schema changes stay additive.
- **Known coupling to revisit:** the `deletedBy: Id<"adminUsers">` choice ties
  LMS soft-delete to the admin actor. This is correct for V1 (admin-processed
  deletions) but must be reconsidered if a distinct learner/operator deletion
  actor is introduced later.
