# @zephyra/ui

The shared, design-token-driven component layer: the 10 generic components, the
two app providers, and the global stylesheets.

```ts
import { Button, Card, Input, Modal, Table } from '@zephyra/ui';
import { ToastProvider, useToast } from '@zephyra/ui/providers/ToastProvider';
import { ConvexProvider } from '@zephyra/ui/providers/ConvexProvider';
```

```ts
// once, in the root layout of each app
import '@zephyra/ui/styles/globals.css';   // itself @imports ./variables.css
```

**Source-exported, no build step.** `exports` points at `.tsx` and `.css`
directly, so every consuming Next app MUST list `@zephyra/ui` in
`transpilePackages` — Next has to run the JSX, the CSS Modules and the styled-jsx
through its own pipeline. This is unlike `@zephyra/convex`, which needs **no**
`transpilePackages` because its entry points are already plain ESM plus a
types-only declaration. The rule is per-package; do not generalise either way.

## The surface, and why it is shaped like this

Five `exports` keys, no wildcard. Anything else is unreachable from another
workspace (`TS2307` at compile time, `ERR_PACKAGE_PATH_NOT_EXPORTED` at runtime).

| Key | Contents |
|---|---|
| `.` | presentational components only — `Button`, `Card`, `IconPicker`, `ImageUpload`, `Input`, `Modal`/`ConfirmDialog`, `Select`, `Skeleton`*, `Table`, `Toast`, plus `ClientOnly`/`ErrorBoundary`, and their prop types |
| `./providers/ConvexProvider` | `ConvexProvider` |
| `./providers/ToastProvider` | `ToastProvider`, `useToast` |
| `./styles/variables.css` | the design tokens |
| `./styles/globals.css` | the base reset; `@import`s `variables.css` |

### Why the providers are NOT on the `.` barrel

`ConvexProvider.tsx` constructs a `ConvexReactClient` from
`NEXT_PUBLIC_CONVEX_URL` at **module scope**. If the barrel re-exported it, every
file that imports a `Button` would drag that module-scope client into its graph —
and this app already cannot be built without `NEXT_PUBLIC_CONVEX_URL` for exactly
that class of reason (see the comment in `turbo.json` about the SCORM asset-proxy
route: page-data collection dies with "Client created with undefined deployment
address"). Keeping the providers on their own subpaths preserves the pre-split
module graph: only the two files that used `@/providers/*` reach them.

The stylesheets are separate for the plainer reason that CSS is imported for
effect and never re-exported from TypeScript.

## This package is a faithful extraction — the tokens were NOT changed

`variables.css` and `globals.css` moved **byte-identical** (R100). That is
deliberate and was ruled explicitly: the token upgrade in the brand guide
(canonical green `#1E3C2E`, retiring the scaffold blue, the `mid`/`soft`/`tint`
greens, spacing `3xl/4xl/5xl`, centralised breakpoints, one merged Button system)
is **deferred to M5**, because landing any of it changes rendered output and this
task's whole value is being provably inert.

The extraction is what makes that upgrade cheap: the scaffold blue is defined
**once**, at `variables.css:9-10`, and consumed through `var(--color-primary)` in
70 declarations across 34 files. Now that the definition lives here, flipping it
is a one-line change that propagates to all three apps.

Two measurements for whoever picks up M5 — both differ from the brand guide's
"inconsistency register", which was written against a smaller sample:

- The blue is **not** confined to `Button` and focus styles. 70
  `var(--color-primary)` declarations in 34 files, spanning the backoffice CMS,
  the learner-facing Academia flows (`auth-learner`, `org-signup`,
  `lms-checkout`) and six of the components in this package.
- Of the five ad-hoc greens, only **three** fold losslessly (`#f0f5f2`→`tint`,
  `#2d5a43`→`mid`, `#3a7055`→`soft`). `#2a5840` and `#2a5540` differ in value
  from the proposed `mid` `#2D5A43`, so folding them changes rendering. Likewise
  the footer's `#213C2F`→`#1E3C2E`, and `3xl: 64px` (the real hardcoded cluster
  is **60px ×8**, not 64; `4xl: 80` and `5xl: 100` do match, 10 sites).

## Dead code carried forward — a known gap

`ClientOnly` and `ErrorBoundary` are exported and have **zero consumers**:
nothing in `apps/legacy` imported either before the move (verified) and nothing
does now. They are here because `domain-boundaries` §3 assigns them to this
package, not because they are in use — so **no test or build exercises them**.
Treat them as unverified until something adopts them.

There are no tests in this package. That is not an omission introduced by the
extraction: these components had no unit tests inside `apps/legacy` either, so
none were moved and none were invented. Adding component tests needs `jsdom` and
`esbuild.jsx: "automatic"` in a new vitest config — a real task, not a refactor.
