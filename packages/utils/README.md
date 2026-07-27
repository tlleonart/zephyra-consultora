# @zephyra/utils

Framework-agnostic shared helpers (formatting, validation, pure domain logic).
**Placeholder** — filled by the shared-UI/utils extraction task; helpers
currently live under `apps/legacy/src/lib`.

## Conventions this scaffold expects

- Consumers declare `"@zephyra/utils": "workspace:*"` and import
  `@zephyra/utils/...`.
- Source-exported by default (no build step): consuming Next apps add it to
  `transpilePackages`.
- `tsconfig.json` extends `../../tsconfig.base.json`.
- Add `lint`/`typecheck`/`test` scripts when there is real code — turbo skips
  undefined tasks.
