/**
 * Pure-logic coverage for stripHtmlToText (T-07, M-HOME amendment).
 * No jsdom in this workspace (vitest.config.ts) — these are plain string
 * assertions, exactly the "logica pura extraida" pattern the rest of this
 * suite already uses (see features/formatPrice.test.ts).
 */
import { describe, it, expect } from "vitest";
import { stripHtmlToText } from "@/lib/strip-html";

describe("stripHtmlToText", () => {
  it("returns an empty string for empty input", () => {
    expect(stripHtmlToText("")).toBe("");
  });

  it("strips a single paragraph wrapper", () => {
    expect(stripHtmlToText("<p>Hola mundo</p>")).toBe("Hola mundo");
  });

  it("never leaves a raw tag visible on screen", () => {
    const out = stripHtmlToText("<p>Curso <strong>avanzado</strong> de DEI</p>");
    expect(out).not.toMatch(/<[^>]+>/);
    expect(out).toBe("Curso avanzado de DEI");
  });

  it("does not collide words across adjacent block elements", () => {
    expect(stripHtmlToText("<p>Hola</p><p>Mundo</p>")).toBe("Hola Mundo");
    expect(stripHtmlToText("Línea uno<br>Línea dos")).toBe("Línea uno Línea dos");
  });

  it("handles lists without merging item text", () => {
    const out = stripHtmlToText("<ul><li>Uno</li><li>Dos</li></ul>");
    expect(out).toBe("Uno Dos");
  });

  it("decodes the common HTML entities the editor emits", () => {
    expect(stripHtmlToText("<p>Diversidad &amp; inclusi&oacute;n</p>")).toContain(
      "Diversidad & inclusi&oacute;n"
    );
    expect(stripHtmlToText("<p>Cupos&nbsp;disponibles</p>")).toBe("Cupos disponibles");
    expect(stripHtmlToText("&quot;Cita&quot; y &#39;otra&#39;")).toBe(
      `"Cita" y 'otra'`
    );
  });

  it("collapses whitespace and trims the result", () => {
    expect(stripHtmlToText("  <p>  Hola   mundo  </p>  ")).toBe("Hola mundo");
  });

  it("returns an empty string for markup with no text content", () => {
    expect(stripHtmlToText("<p></p>")).toBe("");
    expect(stripHtmlToText("<p>   </p>")).toBe("");
  });
});
