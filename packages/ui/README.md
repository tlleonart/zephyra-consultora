# @zephyra/ui

Shared React component library (design-token driven). **Placeholder** — filled
by the shared-UI extraction task; components currently live under
`apps/legacy/src`.

## Conventions this scaffold expects

- Consumers declare `"@zephyra/ui": "workspace:*"` and import `@zephyra/ui/...`.
- Source-exported by default (no build step): consuming Next apps add it to
  `transpilePackages`.
- `tsconfig.json` extends `../../tsconfig.base.json`.
- `eslint.config.mjs` may reuse the root base via
  `nextEslintConfig(__dirname)`, or define its own flat config if the package is
  not Next-specific.
- Add `lint`/`typecheck`/`test` scripts when there is real code — turbo skips
  undefined tasks.
