// styled-jsx's JSX augmentation: adds the `jsx` and `global` props to <style>.
//
// ToastProvider renders `<style jsx global>{...}</style>`. Inside apps/legacy
// that typechecked because next-env.d.ts references `types="next"` and Next's
// type graph carries styled-jsx along. A non-Next package has no next-env.d.ts,
// so without this the component fails with:
//   TS2322: Property 'jsx' does not exist on type
//   'DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>'
//
// WHY THIS IS RE-DECLARED HERE INSTEAD OF REFERENCING UPSTREAM.
// styled-jsx ships exactly this augmentation in its own `global.d.ts`, and
// pointing at it is the obvious fix. It does not work under pnpm. All three
// forms were tried and all three left the error in place:
//   /// <reference types="styled-jsx" />              (resolves ./index.d.ts,
//                                                      which lacks it)
//   /// <reference types="styled-jsx/global" />
//   /// <reference path="../node_modules/styled-jsx/global.d.ts" />
// The last one resolves the file (verified present) yet the augmentation stays
// inert, because upstream writes it as `declare module 'react'` inside its own
// directory — and under pnpm's strict layout that directory's node_modules holds
// only `client-only`, `react` and `styled-jsx`, with **no `@types/react`**
// (verified). So `'react'` there resolves to the untyped JS package and the
// augmentation attaches to nothing.
//
// Declared here, `'react'` resolves to this package's own
// @types/react@19.2.10 — the single copy in the store, the same one apps/legacy
// resolves — so it augments the real interface. The body is upstream's
// styled-jsx/global.d.ts verbatim: zero change to what typechecks, which is the
// whole point of this extraction.
import 'react';

declare module 'react' {
  interface StyleHTMLAttributes<T> extends HTMLAttributes<T> {
    jsx?: boolean;
    global?: boolean;
  }
}
