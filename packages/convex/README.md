# @zephyra/convex

Shared Convex backend (schema, functions, generated client) consumed by every
app. **Placeholder** — filled by the `convex/` extraction task; the code
currently lives at `apps/legacy/convex`.

## Conventions this scaffold expects

- **Workspace protocol.** Consumers declare it as
  `"@zephyra/convex": "workspace:*"` in their `dependencies`, then import
  `@zephyra/convex/...` instead of reaching across the tree with
  `../../convex/_generated/...`.
- **No build step required.** If this package ships TypeScript source directly
  (the internal-package pattern), consuming Next apps must list it in
  `transpilePackages`. If it does emit, add a `build` script — `turbo.json`
  already wires `build` to `^build` and `typecheck` to `^build`, so an emitting
  package needs no turbo changes.
- **`tsconfig.json` must extend `../../tsconfig.base.json`.** The base carries
  only compiler options; `paths`, `include`/`exclude` and framework plugins are
  per-workspace.
- Declare `dev`/`build`/`lint`/`typecheck`/`test` scripts only once they do
  something real — turbo skips undefined tasks.
