# Architecture Decision Records (ADRs)

This directory records the significant architectural decisions for the Zephyra
platform, including the LMS feature track introduced in Sprint 0
(`specs/008-zephyra-lms-foundation`).

ADRs are written in English (internal engineering convention) and use the
lightweight Nygard format: **Context → Decision → Consequences**.

Directory choice: ADRs live at the repository root under `docs/decisions/`
(the default) rather than per-spec (`specs/008-.../decisions/`). The repo had no
existing `decisions/` convention when these were authored, and the decisions
recorded here are platform-wide (stack ratification, content format, repository
topology), not scoped to a single spec — so a single top-level register is the
correct home.

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-0001](./0001-extend-zephyra-consultora-with-lms.md) | Extend `zephyra-consultora` with the LMS; ratify the Next.js + Convex + Nodemailer stack | Accepted |
| [ADR-0002](./0002-scorm-1.2-as-canonical-content-format.md) | SCORM 1.2 as the canonical content format | Accepted |
| ADR-0003 | _(Auth library selection)_ | **Dropped** |
| [ADR-0004](./0004-lms-as-feature-track-not-separate-repo.md) | The LMS lives in `zephyra-consultora` as a feature track, not a separate repo | Accepted |
| [ADR-0005](./0005-same-origin-proxy-for-sco-assets.md) | Same-origin proxy for SCO assets (S0-R3 resolution) | Accepted |
| [ADR-0006](./0006-ingest-scorm-package-as-convex-action.md) | `ingestScormPackage` as a Convex action, not a mutation (S0-R8 resolution) | Accepted |
| [ADR-0007](./0007-learner-auth-magic-link-plus-password.md) | Learner auth: magic-link primary + optional password + distinct cookie / signing key | Accepted |
| [ADR-0008](./0008-password-hashing-argon2id-plus-lazy-rehash.md) | Password hashing: argon2id (via `hash-wasm`) + lazy re-hash + HMAC for opaque tokens | Accepted |
| [ADR-0009](./0009-paymentprovider-interface-checkout-pro.md) | PaymentProvider interface + MercadoPago Checkout Pro (hosted redirect) | Accepted |
| [ADR-0010](./0010-webhook-idempotency-verify-before-trust.md) | Webhook idempotency (triple) + verify-before-trust | Accepted |
| [ADR-0011](./0011-usd-pricing-mp-side-ars-conversion.md) | USD pricing with MercadoPago-side ARS conversion | Accepted |
| [ADR-0012](./0012-order-payment-state-machine.md) | Order/payment state machine (no intermediate states) | Accepted |

### Why ADR-0003 is dropped

ADR-0003 was originally reserved for an authentication-library decision. It is
**dropped, not authored**: the authentication mechanism is already chosen and in
production — JWT custom auth with `jose` 5.9 signed cookies and route protection
in `middleware.ts`, backing the existing `adminUsers` table. There is no open
decision to record. Candidate replacements (Better-Auth, Lucia) were rejected at
the PDD stage precisely because the existing pattern works and reusing it
eliminates an entire POC sprint. The learner-auth audience (Sprint 1) reuses the
same JWT pattern with a separate cookie and signing key; that is a Sprint 1
implementation detail, not a new library decision. The number `0003` is retired
to keep ADR numbering aligned with the original sprint planning.
