/**
 * La ficha `/cursos/[slug]`, bloque "Sobre este curso": la descripción escrita
 * en el panel se ve con su formato.
 *
 * La página es un server component `async` que consulta Convex, así que no se
 * renderiza entera en este runner (mismo criterio que my-courses-page.test.tsx).
 * Se renderiza a HTML estático —lo mismo que hace el servidor— el componente
 * que pinta el bloque, alimentado por la misma función que usa la página; y de
 * la página se afirma la estructura: que use ese componente con esa función y
 * que no sea un client component (el formato tiene que estar en el HTML del
 * servidor, no sólo después de hidratar).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { CourseDescriptionBody } from "@/app/(public)/cursos/[slug]/CourseDescriptionBody";
import { resolveCourseDescriptionHtml } from "@/lib/sanitize-description";

const PAGE_DIR = path.resolve(__dirname, "../../../src/app/(public)/cursos/[slug]");
const read = (f: string) => fs.readFileSync(path.join(PAGE_DIR, f), "utf8");
const BLOCK_COMMENT = new RegExp(String.raw`/\*[\s\S]*?\*/`, "g");
const LINE_COMMENT = new RegExp(String.raw`^\s*//.*$`, "gm");
const code = (src: string) => src.replace(BLOCK_COMMENT, "").replace(LINE_COMMENT, "");

const FALLBACK = "Curso de prueba. Formación online a tu ritmo.";

const renderBody = (description?: string) =>
  renderToStaticMarkup(
    <CourseDescriptionBody
      html={resolveCourseDescriptionHtml({ description })}
      fallback={FALLBACK}
      className="description"
    />
  );

describe("CA-2: una descripción con formato sale con ese formato", () => {
  const DESCRIPCION =
    "<p>Un curso <strong>práctico</strong>, <em>breve</em>, <u>aplicable</u> y <s>aburrido</s>.</p>" +
    "<h3>Qué vas a aprender</h3>" +
    "<ul><li><p>Marco conceptual</p></li><li><p>Casos reales</p></li></ul>";

  const html = renderBody(DESCRIPCION);

  it("conserva strong, em, u y s", () => {
    expect(html).toContain("<strong>práctico</strong>");
    expect(html).toContain("<em>breve</em>");
    expect(html).toContain("<u>aplicable</u>");
    expect(html).toContain("<s>aburrido</s>");
  });

  it("conserva la lista y el h3", () => {
    expect(html).toContain("<h3>Qué vas a aprender</h3>");
    expect(html).toMatch(/<ul><li><p>Marco conceptual<\/p><\/li><li><p>Casos reales<\/p><\/li><\/ul>/);
  });

  it("va dentro del bloque con la clase de lectura, y no muestra el respaldo", () => {
    expect(html.startsWith('<div class="description">')).toBe(true);
    expect(html).not.toContain(FALLBACK);
  });

  it("lo peligroso no llega al HTML aunque venga en la descripción", () => {
    const out = renderBody(
      '<p>ok<script>alert(1)</script><img src=x onerror="alert(2)"></p><p><a href="javascript:alert(3)">x</a></p>'
    );
    // "description" (la clase) contiene "script": se busca la etiqueta.
    expect(out).not.toMatch(/<script|onerror|<img|javascript:|alert/i);
    expect(out).toContain("ok");
  });
});

describe("CA-6: sin descripción escrita, el respaldo del SCORM igual que hoy", () => {
  it("sin campo, vacía o sólo &nbsp; → un párrafo con el respaldo", () => {
    for (const d of [undefined, "", "<p>&nbsp;</p>", "<p></p>"]) {
      expect(renderBody(d)).toBe(`<div class="description"><p>${FALLBACK}</p></div>`);
    }
  });
});

describe("CA-3: la página lo pinta en el servidor", () => {
  const PAGE = code(read("page.tsx"));
  const BODY = code(read("CourseDescriptionBody.tsx"));

  it("la página usa el componente con la descripción sanitizada", () => {
    expect(PAGE).toMatch(/from "@\/lib\/sanitize-description"/);
    expect(PAGE).toMatch(/resolveCourseDescriptionHtml\(course\)/);
    expect(PAGE).toMatch(/<CourseDescriptionBody[\s\S]*?html=\{descripcionHtml\}/);
    expect(PAGE).toMatch(/fallback=\{fallbackDescription\(course\)\}/);
  });

  it("la página no pinta la descripción cruda por otro lado", () => {
    expect(PAGE).not.toMatch(/dangerouslySetInnerHTML/);
    expect(PAGE).not.toMatch(/course\.description/);
  });

  it("ni la página ni el componente son client components", () => {
    expect(PAGE).not.toMatch(/^\s*["']use client["']/m);
    expect(BODY).not.toMatch(/^\s*["']use client["']/m);
    expect(BODY).not.toMatch(/useEffect|useState|useLayoutEffect/);
  });
});
