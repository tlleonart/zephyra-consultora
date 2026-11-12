/**
 * El sanitizado de la descripción del curso antes de pintarla como HTML en la
 * ficha pública `/cursos/[slug]`.
 *
 * El HTML lo escribe el panel y la ficha es pública: una cuenta del panel
 * comprometida no puede meter script en la Academia. Lista cerrada:
 * p br strong b em i u s ul ol li h2 h3 h4 blockquote a; único atributo
 * `href` en `a` (http, https, mailto), con rel y target forzados. Lo demás se
 * descarta y su texto se conserva, salvo script/style/iframe, que se van
 * enteros.
 */
import { describe, it, expect } from "vitest";
import {
  DESCRIPTION_ALLOWED_TAGS,
  sanitizeCourseDescription as clean,
  resolveCourseDescriptionHtml,
} from "@/lib/sanitize-description";

describe("lo que el editor emite y se pide ver, pasa intacto", () => {
  it("las marcas de texto", () => {
    const html =
      "<p><strong>negrita</strong> <b>b</b> <em>cursiva</em> <i>i</i> <u>subrayado</u> <s>tachado</s></p>";
    expect(clean(html)).toBe(html);
  });

  it("listas, títulos, cita y salto de línea", () => {
    const html =
      "<h2>Dos</h2><h3>Tres</h3><h4>Cuatro</h4><ul><li><p>a</p></li></ul><ol><li><p>b</p></li></ol><blockquote><p>cita</p></blockquote><p>uno<br />dos</p>";
    expect(clean(html)).toBe(html);
  });

  it("la lista permitida es exactamente la pedida", () => {
    expect([...DESCRIPTION_ALLOWED_TAGS].sort()).toEqual(
      ["p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "h2", "h3", "h4", "blockquote", "a"].sort()
    );
  });
});

describe("los enlaces", () => {
  it("conservan href http/https/mailto y salen con rel y target forzados", () => {
    for (const href of [
      "https://zephyra.example/x",
      "http://zephyra.example/x",
      "mailto:hola@zephyra.example",
    ]) {
      expect(clean(`<a href="${href}">ir</a>`)).toBe(
        `<a href="${href}" rel="noopener noreferrer" target="_blank">ir</a>`
      );
    }
  });

  it("rel y target del autor se pisan", () => {
    expect(
      clean('<a href="https://x.example" rel="opener" target="_self">ir</a>')
    ).toBe(
      '<a href="https://x.example" rel="noopener noreferrer" target="_blank">ir</a>'
    );
  });

  it('href="javascript:..." no sobrevive (tampoco disfrazado)', () => {
    for (const href of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      " javascript:alert(1)",
      "jav&#x09;ascript:alert(1)",
    ]) {
      const out = clean(`<a href="${href}">ir</a>`);
      expect(out).not.toMatch(/javascript/i);
      expect(out).not.toMatch(/href=/);
      expect(out).toContain("ir");
    }
  });

  it('href="data:..." no sobrevive', () => {
    const out = clean('<a href="data:text/html;base64,PHNjcmlwdD4=">ir</a>');
    expect(out).not.toMatch(/data:/i);
    expect(out).not.toMatch(/href=/);
    expect(out).toContain("ir");
  });

  it("protocol-relative y otros esquemas tampoco", () => {
    expect(clean('<a href="//evil.example">ir</a>')).not.toMatch(/href=/);
    expect(clean('<a href="vbscript:x">ir</a>')).not.toMatch(/href=/);
  });

  it("ningún otro atributo pasa en un enlace", () => {
    const out = clean(
      '<a href="https://x.example" onclick="alert(1)" style="color:red" class="c" id="i">ir</a>'
    );
    expect(out).toBe(
      '<a href="https://x.example" rel="noopener noreferrer" target="_blank">ir</a>'
    );
  });
});

describe("CA-4: lo peligroso no sobrevive", () => {
  it("<script> se va con su contenido; el texto de alrededor queda", () => {
    const out = clean("<p>antes<script>alert('x')</script>después</p>");
    expect(out).toBe("<p>antesdespués</p>");
    expect(out).not.toMatch(/script|alert/i);
  });

  it("<style> se va con su contenido", () => {
    const out = clean("<p>hola</p><style>body{display:none}</style><p>chau</p>");
    expect(out).toBe("<p>hola</p><p>chau</p>");
  });

  it("<iframe> se va con su contenido", () => {
    const out = clean(
      '<p>antes</p><iframe src="https://evil.example">adentro</iframe><p>después</p>'
    );
    expect(out).toBe("<p>antes</p><p>después</p>");
  });

  it("<img> se descarta, con su onerror=", () => {
    const out = clean('<p>uno <img src="x" onerror="alert(1)"> dos</p>');
    expect(out).not.toMatch(/<img|onerror|alert/i);
    expect(out).toBe("<p>uno  dos</p>");
  });

  it("onerror= / on*= en una etiqueta permitida se descarta", () => {
    const out = clean('<p onclick="alert(1)">t <strong onmouseover="x()">n</strong></p>');
    expect(out).toBe("<p>t <strong>n</strong></p>");
  });

  it("style= se descarta en cualquier etiqueta", () => {
    expect(clean('<p style="color:red">rojo</p>')).toBe("<p>rojo</p>");
    expect(clean('<strong style="font-size:90px">x</strong>')).toBe(
      "<strong>x</strong>"
    );
  });

  it("class=, id= y data-* se descartan", () => {
    expect(clean('<p class="editor-x" id="a" data-x="1">t</p>')).toBe("<p>t</p>");
  });

  it("una etiqueta fuera de la lista se va pero su texto queda", () => {
    expect(clean("<div>bloque <span>suelto</span></div>")).toBe("bloque suelto");
    expect(clean("<h1>Título</h1><p>cuerpo</p>")).toBe("Título<p>cuerpo</p>");
    expect(
      clean("<table><tr><td>celda</td></tr></table>")
    ).toBe("celda");
  });

  it("svg y su script no pasan", () => {
    const out = clean('<p>a<svg onload="alert(1)"><script>alert(2)</script></svg>b</p>');
    expect(out).not.toMatch(/svg|onload|alert|script/i);
    expect(out).toContain("a");
    expect(out).toContain("b");
  });

  it("el texto con < y > se escapa, no se vuelve marcado", () => {
    const out = clean("<p>1 &lt; 2 &amp;&amp; <b>3</b></p>");
    expect(out).toBe("<p>1 &lt; 2 &amp;&amp; <b>3</b></p>");
  });

  it("vacío devuelve vacío", () => {
    expect(clean("")).toBe("");
  });
});

describe("resolveCourseDescriptionHtml: cuándo hay descripción escrita", () => {
  it("devuelve el HTML sanitizado cuando hay texto", () => {
    expect(
      resolveCourseDescriptionHtml({
        description: '<p style="x"><strong>Hola</strong></p>',
      })
    ).toBe("<p><strong>Hola</strong></p>");
  });

  it("sin campo, vacío o sólo &nbsp; → null (cae al respaldo del SCORM)", () => {
    expect(resolveCourseDescriptionHtml({})).toBeNull();
    expect(resolveCourseDescriptionHtml({ description: "" })).toBeNull();
    expect(resolveCourseDescriptionHtml({ description: "<p>&nbsp;</p>" })).toBeNull();
    expect(
      resolveCourseDescriptionHtml({ description: "<p></p><p>&nbsp;</p>" })
    ).toBeNull();
  });

  it("si el sanitizado no deja nada visible, también null", () => {
    expect(
      resolveCourseDescriptionHtml({ description: "<script>alert(1)</script>" })
    ).toBeNull();
  });
});
