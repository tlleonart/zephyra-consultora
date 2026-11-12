/**
 * Subrayado en el editor de texto enriquecido (descripción de cursos, blog,
 * proyectos — los tres usan el mismo WysiwygEditor).
 *
 * Este runner es Node sin DOM (vitest.config.ts), así que el editor montado no
 * se puede ejercitar acá. Lo que sí se prueba:
 *  - el esquema que arma el editor tiene la marca `underline`, se serializa
 *    como `<u>` y se reconoce al volver a cargar HTML guardado con `<u>`;
 *  - el comando de la marca la pone y la saca sobre una selección (lo mismo
 *    que hace el botón y Ctrl+U);
 *  - la extensión trae el atajo Mod-u (Ctrl+U en Windows/Linux, Cmd+U en Mac);
 *  - el componente registra la extensión y tiene el botón en el grupo de
 *    negrita/cursiva/tachado.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getSchema } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { toggleMark } from "@tiptap/pm/commands";

const REPO = path.resolve(__dirname, "../../../../../..");
const EDITOR_SRC = fs.readFileSync(
  path.join(
    REPO,
    "apps/backoffice/src/features/blog/components/WysiwygEditor/WysiwygEditor.tsx"
  ),
  "utf8"
);

const schema = getSchema([
  StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
  Underline,
]);

describe("la marca underline en el esquema del editor", () => {
  it("existe y se serializa como <u>", () => {
    const markType = schema.marks.underline;
    expect(markType).toBeDefined();
    const dom = markType.spec.toDOM?.(markType.create(), true);
    expect(Array.isArray(dom) ? dom[0] : null).toBe("u");
  });

  it("reconoce <u> al cargar HTML ya guardado", () => {
    const tags = (schema.marks.underline.spec.parseDOM ?? []).map(
      (rule) => ("tag" in rule ? rule.tag : undefined)
    );
    expect(tags).toContain("u");
  });

  it("el comando la aplica y la quita sobre el texto seleccionado", () => {
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [schema.text("Hola mundo")]),
    ]);
    let state = EditorState.create({ schema, doc });
    // Selecciona "Hola" (posiciones 1..5 dentro del primer párrafo).
    state = state.apply(
      state.tr.setSelection(TextSelection.create(state.doc, 1, 5))
    );
    const toggle = toggleMark(schema.marks.underline);

    toggle(state, (tr) => {
      state = state.apply(tr);
    });
    expect(state.doc.rangeHasMark(1, 5, schema.marks.underline)).toBe(true);
    expect(state.doc.rangeHasMark(5, 11, schema.marks.underline)).toBe(false);

    toggle(state, (tr) => {
      state = state.apply(tr);
    });
    expect(state.doc.rangeHasMark(1, 5, schema.marks.underline)).toBe(false);
  });
});

describe("el atajo de teclado", () => {
  it("la extensión declara Mod-u (Ctrl+U / Cmd+U)", () => {
    const shortcuts = Underline.config.addKeyboardShortcuts;
    expect(typeof shortcuts).toBe("function");
    const src = String(shortcuts);
    expect(src).toMatch(/["']Mod-u["']/);
  });
});

describe("el componente WysiwygEditor", () => {
  it("registra la extensión Underline", () => {
    expect(EDITOR_SRC).toMatch(
      /import Underline from ['"]@tiptap\/extension-underline['"]/
    );
    expect(EDITOR_SRC).toMatch(/^\s*Underline,\s*$/m);
  });

  it("tiene el botón U entre cursiva y tachado, con estado activo", () => {
    const italic = EDITOR_SRC.indexOf("toggleItalic()");
    const underline = EDITOR_SRC.indexOf("toggleUnderline()");
    const strike = EDITOR_SRC.indexOf("toggleStrike()");
    expect(italic).toBeGreaterThan(-1);
    expect(underline).toBeGreaterThan(italic);
    expect(strike).toBeGreaterThan(underline);
    expect(EDITOR_SRC).toMatch(/isActive\(['"]underline['"]\)/);
    expect(EDITOR_SRC).toMatch(/<u>U<\/u>/);
  });
});
