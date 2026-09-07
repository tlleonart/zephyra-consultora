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
| `.` | presentational components only — `Button`, `Card`, `DropdownMenu`, `IconPicker`, `ImageUpload`, `Input`, `Modal`/`ConfirmDialog`, `Select`, `Skeleton`*, `Table`, `Toast`, plus `ClientOnly`/`ErrorBoundary`, and their prop types |
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

## `sideEffects` — tree-shaking vs CSS

`package.json` declares:

```json
"sideEffects": ["**/*.css"]
```

**Why the field exists at all.** `src/index.ts` is a barrel re-exporting 12
components, one of which (`ImageUpload`) pulls in `convex/react` +
`@zephyra/convex/_generated/api`. With **no** `sideEffects` field a bundler must
assume every module in the package has side effects, so it cannot drop the
unused re-exports — a route that imports only `Skeleton` still makes that whole
Convex graph reachable. Roughly 49 app files import this barrel.

**Why the value is not `false`.** `"sideEffects": false` is the obvious fix and
it is the wrong one here. Webpack treats `import styles from './X.module.css'`
as a side-effectful import, and `false` licenses dropping it — which silently
ships the components with no styles. Listing CSS as the side-effectful set lets
the JavaScript tree-shake while every stylesheet survives.

**How to re-verify after touching it.** A green typecheck proves nothing about
this. Boot a consumer app and confirm a token-driven computed style still
resolves — for `apps/www`, `next start` and grep the served CSS for the brand
green `#1E3C2E`. A change that trims the bundle by dropping styles is worse than
the original finding.

## `DropdownMenu` — la primitiva de menú, y por qué no se queda con el elemento

Este paquete no tenía ninguna primitiva de menú: había `Button`, `Card`,
`IconPicker`, `ImageUpload`, `Input`, `Modal`/`ConfirmDialog`, `Select`,
`Skeleton`, `Table`, `Toast`, `ClientOnly`, `ErrorBoundary` y `btnClass`.
Cualquier menú de cuenta se iba a construir a mano en cada superficie que lo
necesitara, con la accesibilidad reinventada cada vez — y el testing ya había
levantado foco que existe y no se ve.

Lo que la primitiva garantiza: se abre y se opera sólo con teclado; el
disparador declara `aria-haspopup` y `aria-expanded`; el foco **entra** al menú
al abrirlo; `Escape` cierra y **devuelve** el foco al disparador; el foco es
visible siempre (se estila `:focus`, no sólo `:focus-visible`, porque el menú
mueve el foco por código); y cada blanco táctil mide 44px.

**Los ítems de navegación los renderiza el consumidor** (`kind: 'custom'`), por
la misma razón por la que existe `btnClass`: este paquete no contiene ni un
ancla ni un `next/link`, y reescribir una navegación como `<button>` pierde
`href`, el click del medio y el rol correcto para tecnología asistiva. La
primitiva presta el rol, el `tabIndex`, la clase, la `ref` y el cierre al
activar; el elemento lo elige quien lo usa. Los que sí renderiza son los que no
son navegación: `kind: 'action'` (un `<button>` con `onSelect`) y
`kind: 'form'` (un `<form action={serverAction}>`, el patrón que ya usa el
cierre de sesión de la superficie de empresa).

`resolveMenuKey` también sale al barril, y no es un detalle interno filtrado:
es la máquina de teclado, pura, y exportarla es lo que permite verificar las
reglas de foco tecla por tecla en un runner sin DOM.

### Una deuda con nombre: este paquete no tiene runner de tests

`package.json` declara `lint` y `typecheck` y nada más, así que la tarea `test`
de turbo no alcanza a ninguno de sus componentes. Los tests de `DropdownMenu`
viven, por eso, en `apps/academia/tests/unit/ui/` — academia lo consume por
workspace y su runner lo resuelve, así que corren y cuentan. Darle runner
propio al paquete significa agregar vitest a sus devDependencies y tocar el
lockfile; queda anotado acá para que se decida a propósito y no por inercia.
