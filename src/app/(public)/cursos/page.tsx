export const dynamic = "force-dynamic";

export const metadata = {
  title: "Cursos | Zephyra Consultora",
  description:
    "Catálogo de cursos de Zephyra Consultora. Formación en sostenibilidad, diversidad e impacto.",
};

// Public LMS course catalog.
// Scaffolded in Sprint 0 (Phase A). The course grid + enrollment flow are
// built in later phases / Sprint 1. This placeholder confirms the route group
// renders under the public layout (Navbar + Footer).
export default function CursosPage() {
  return (
    <section style={{ maxWidth: 960, margin: "0 auto", padding: "4rem 1.5rem" }}>
      <h1>Cursos</h1>
      <p>
        Catálogo de cursos en construcción. Pronto vas a poder explorar la
        oferta de formación de Zephyra.
      </p>
    </section>
  );
}
