/**
 * P-10 — la descripción escrita también manda en la FICHA del curso.
 *
 * Por qué existe este archivo. T-07 corrigió el catálogo: la tarjeta dejó de
 * mostrar un texto derivado del paquete SCORM y pasó a mostrar la descripción
 * que se escribe en el panel. La ficha `/cursos/[slug]` quedó con el defecto
 * intacto durante todo ese arreglo, porque tenía su propia copia local de
 * `deriveDescription` y de `deriveScoCount` — y el encabezado de
 * `lib/course-catalog` afirmaba mientras tanto que era "the single place that
 * does it, so the two call sites cannot drift". No lo era: había dos.
 *
 * Los tests de T-07 pasaron por encima de esto sin ver nada, porque sólo
 * miraban el módulo compartido. Este archivo cierra ese hueco por los dos
 * lados: la lógica nueva (párrafos) y el invariante estructural (que la ficha
 * no vuelva a tener una copia propia).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { stripHtmlToParagraphs } from "@/lib/strip-html";
import {
  scoOrgTitle,
  resolveCourseDescriptionParagraphs,
} from "@/lib/course-catalog";

describe("stripHtmlToParagraphs", () => {
  it("no devuelve nada cuando no hay nada", () => {
    expect(stripHtmlToParagraphs("")).toEqual([]);
  });

  it("conserva un párrafo por bloque del editor", () => {
    expect(
      stripHtmlToParagraphs(
        "<p>Marco conceptual.</p><p>Prácticas <strong>concretas</strong>.</p>"
      )
    ).toEqual(["Marco conceptual.", "Prácticas concretas."]);
  });

  it("trata el salto duro como un corte de párrafo", () => {
    expect(stripHtmlToParagraphs("<p>Uno<br>Dos</p>")).toEqual(["Uno", "Dos"]);
  });

  it("descarta los bloques que quedan vacíos", () => {
    expect(
      stripHtmlToParagraphs("<p>Uno</p><p>&nbsp;</p><p></p><p>Dos</p>")
    ).toEqual(["Uno", "Dos"]);
  });

  it("es la diferencia con stripHtmlToText: acá el texto NO se aplana", () => {
    // Ésta es la razón de ser de la función. Si algún día alguien la
    // reemplaza por stripHtmlToText, esta aserción se cae.
    const html = "<p>Uno</p><p>Dos</p><p>Tres</p>";
    expect(stripHtmlToParagraphs(html)).toHaveLength(3);
  });
});

describe("scoOrgTitle", () => {
  it("devuelve el título del manifiesto cuando tiene cuerpo", () => {
    expect(
      scoOrgTitle({ organizations: { title: "Diversidad, Equidad e Inclusión" } })
    ).toBe("Diversidad, Equidad e Inclusión");
  });

  it("devuelve null cuando no hay título aprovechable", () => {
    expect(scoOrgTitle(undefined)).toBeNull();
    expect(scoOrgTitle({ organizations: { title: "Curso" } })).toBeNull();
  });
});

describe("resolveCourseDescriptionParagraphs", () => {
  it("usa lo que se escribió en el panel, sin el marcado", () => {
    expect(
      resolveCourseDescriptionParagraphs({
        description: "<p>Marco conceptual.</p><p>Y <em>práctica</em>.</p>",
      })
    ).toEqual(["Marco conceptual.", "Y práctica."]);
  });

  it("devuelve vacío — no una frase de reserva — cuando no hay descripción", () => {
    // Deliberado: cada superficie tiene su propia frase de reserva, y la de la
    // ficha lleva el título adentro porque la ficha no lo repite arriba.
    expect(resolveCourseDescriptionParagraphs({})).toEqual([]);
    expect(resolveCourseDescriptionParagraphs({ description: "" })).toEqual([]);
    expect(
      resolveCourseDescriptionParagraphs({ description: "<p>&nbsp;</p>" })
    ).toEqual([]);
  });
});

describe("P-10 — la ficha no vuelve a tener su propia copia", () => {
  const FICHA = fs.readFileSync(
    path.resolve(
      __dirname,
      "../../../src/app/(public)/cursos/[slug]/page.tsx"
    ),
    "utf8"
  );

  it("no define un deriveDescription local", () => {
    expect(FICHA).not.toMatch(/function\s+deriveDescription\s*\(/);
  });

  it("no define un deriveScoCount local", () => {
    expect(FICHA).not.toMatch(/function\s+deriveScoCount\s*\(/);
  });

  it("lee la resolución de descripción del módulo compartido", () => {
    expect(FICHA).toMatch(/resolveCourseDescriptionParagraphs/);
    expect(FICHA).toMatch(/from "@\/lib\/course-catalog"/);
  });
});
