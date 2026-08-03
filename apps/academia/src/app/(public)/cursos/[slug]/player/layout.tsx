import styles from "./layout.module.css";

// Player layout: the SCORM player is a focused, full-viewport surface. It is
// nested in the (public) route group (so the route stays public) but must NOT
// inherit the institutional Navbar/Footer chrome, which would overlap the
// player iframe. A fixed full-viewport container lifts the player above that
// chrome without changing the route group or the public layout.
//
// The container element and its box are unchanged from T-fe-008; only the four
// inline literal styles moved into layout.module.css so the surface is themable
// (and so the repo keeps "tokens only, no literal styles"). The iframe's parent
// chain is identical — nothing was wrapped, nothing was reparented.
export default function PlayerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={styles.shell}>{children}</div>;
}
