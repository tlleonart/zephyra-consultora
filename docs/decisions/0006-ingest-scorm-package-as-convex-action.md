# ADR-0006 — `ingestScormPackage` as a Convex action (not a mutation)

- **Status:** Accepted (2026-06-05)
- **Sprint:** SPRINT-ZEPHYRA-LMS-0 (discovered) / SPRINT-ZEPHYRA-LMS-1 (locked into ADR)
- **Spec:** `specs/008-zephyra-lms-foundation/`
- **Relates to:** [ADR-0001](./0001-extend-zephyra-consultora-with-lms.md),
  [ADR-0002](./0002-scorm-1.2-as-canonical-content-format.md)

## Context

The SCORM ingestion path needs to read the contents of `imsmanifest.xml` (the
package's manifest) after the client has unzipped the package and uploaded each
file to Convex `_storage`. Reading a stored blob as text is done via
`(await ctx.storage.get(id))?.text()`.

In Convex 1.17, the blob `.text()` reader is only available in queries and
actions — **mutations cannot call it**. The runtime split is deliberate:
mutations are transactional and must be cheap and deterministic, so the
streaming readers (which can block on large blobs and are not transactional
with the database) are not exposed to them. This was risk **S0-R8** in the
Sprint 0 plan ("manifest parse hits mutation timeout"); the actual constraint
turned out to be stricter — the reader is unavailable in mutations at all, not
merely slow.

## Decision

`ingestScormPackage` is a Convex `action`, not a `mutation`. The action:

1. Authenticates the caller via `ctx.runQuery(internal.adminUsers.getCurrentUser, { userId })`
   (the auth helpers are query-based; actions reach them through `runQuery`).
2. Reads and parses `imsmanifest.xml` from `_storage` in memory.
3. Delegates the database insert to an `internalMutation` (`insertCourse`)
   called via `ctx.runMutation(internal.lms.courses.insertCourse, ...)`.

Clients invoke the action through `useAction(api.lms.courses.ingestScormPackage)`
on the frontend; the call shape is otherwise identical to a mutation from the
caller's perspective.

## Consequences

- Reading manifests of arbitrary size cannot hit the mutation timeout because
  the read happens inside an action (S0-R8 resolved structurally — the issue
  is closed by construction, not by tuning).
- Clean separation: the action owns "read the blob + validate the manifest";
  the internalMutation owns "write the row". A failure during parse never
  partially writes; a failure during insert is its own transactional unit.
- Auth in the action runs via `ctx.runQuery(internal.adminUsers.getCurrentUser, ...)`
  because actions lack `ctx.db`. This is one extra Convex round-trip per
  ingest, but ingest is a low-frequency operation (admin uploads a new course),
  so the overhead is irrelevant.
- The `internalMutation` is not exposed in the public API; clients can only
  reach the insert through the action, which keeps manifest-validation
  centralized server-side and prevents bypass.

## Alternatives considered

- **Parse the manifest on the client and send the parsed structure to a
  mutation.** Rejected — manifest format validation belongs server-side
  (clients are untrusted), and the parser shape would have to be wire-typed
  in addition to its current shape. The action gives us server-side parsing
  for the same caller ergonomics.
- **Switch all mutations to actions.** Rejected — overkill; mutations remain
  the right tool everywhere `.text()` / `.arrayBuffer()` are not needed, and
  losing the mutation's transactional guarantees by default is a regression.
- **Stream the manifest separately and store the parsed JSON alongside the
  package.** Rejected — adds a permanent denormalized field that has to stay
  in sync with the underlying file; an action that parses on demand keeps the
  manifest as the single source of truth.
