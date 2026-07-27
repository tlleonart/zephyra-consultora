// Ambient declaration for CSS Module imports.
//
// Inside apps/legacy these components typechecked because `next-env.d.ts`
// references "next/types/global", which declares `*.module.css` as
// `{ readonly [key: string]: string }`. A non-Next package has no next-env.d.ts,
// so `import styles from './Button.module.css'` would be TS2307 here.
//
// This mirrors Next's own declaration exactly rather than inventing a stricter
// one: the components index into `styles[variant]` with a computed key, which a
// typed-per-class declaration would reject. Keeping it identical to what these
// files were already checked under is the point — the extraction must not change
// what typechecks.
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
