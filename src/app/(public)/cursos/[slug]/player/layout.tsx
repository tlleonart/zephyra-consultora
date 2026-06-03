// Player layout: the SCORM player is a focused, full-viewport surface. It is
// nested in the (public) route group (so the route stays public) but must NOT
// inherit the institutional Navbar/Footer chrome, which would overlap the
// player iframe. A fixed full-viewport container lifts the player above that
// chrome without changing the route group or the public layout.
export default function PlayerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "#fff",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}
