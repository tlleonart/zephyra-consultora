# @zephyra/utils

Framework-agnostic helpers shared by more than one app.

```ts
import { cn } from '@zephyra/utils';
```

**Source-exported, no build step.** `exports` points `.` straight at
`src/index.ts`, so consuming Next apps must list `@zephyra/utils` in
`transpilePackages` (see `apps/legacy/next.config.ts`).

## The surface is one entry point, on purpose

There is exactly one `exports` key (`.`) and it re-exports a named allow-list.
Anything not named in `src/index.ts` is unreachable from another workspace:
`TS2307` at compile time, `ERR_PACKAGE_PATH_NOT_EXPORTED` at runtime. That is a
cheap, *enforced* boundary — if an import fails, widen it deliberately or move
the code, do not add a wildcard to make the error go away.

## What belongs here — and what does not

**Here:** pure, framework-agnostic helpers with no app-specific knowledge, used
by two or more apps. `cn` (conditional className join) is the current whole of
it; it has 13 call sites across the institutional CMS, the learner flows and the
shared components.

**Not here:** app-specific senders and templates.

In particular the **mailer was deliberately left in `apps/legacy`**, against a
first reading of the split plan. Two modules duplicate the same
Resend-primary / Ferozo-SMTP-fallback dispatch —
`src/lib/mailer/learner.ts` (Academia) and
`src/features/auth/actions/password-reset.ts` (Backoffice) — but:

1. `domain-boundaries` §3 routes `lib/mailer/learner.ts` and `src/emails/*` to
   **`apps/academia`**, not to a shared package. Hoisting them here would
   contradict the boundary doc and put one app's sender in everyone's tree.
2. The only genuinely *shared* part is the transport dispatch, and factoring it
   out means **rewriting both callers** — a behaviour-affecting refactor of an
   auth flow. That must not ride inside an extraction whose value is being
   provably inert.
3. `apps/legacy/tests/unit/lib/mailer/learner.test.ts` tests it in place, and
   `requestSeatInvite.test.ts` mocks the module specifier
   `@/lib/mailer/learner`. Moving it edits tests that guard a money-adjacent
   flow, for no functional gain.

Unifying the two transports is worth doing — as its own task, alongside the
per-app email/URL routing already tracked as PDD §M4. Recorded here so a future
task does not "fix" the omission by accident.
