/**
 * Tests de convex/lms/suspendData.ts — T-be-001.
 *
 * Cubren AC 17 y AC 22 de SPEC-CUENTA-ALUMNA-2026-09-04 v1.2.
 *
 * AC 17 — "el formato está caracterizado y el parseo se justifica contra
 * datos; NO se parsea sobre una suposición". Por eso el primer bloque no
 * corre contra ejemplos escritos a mano: corre contra las 264 muestras
 * reales del volcado previo al reset, importadas verbatim desde
 * tests/fixtures/scormRealSamples2026-09-04.ts. Si mañana alguien cambia el
 * parser para reconocer una forma que nunca ocurrió, estos tests no lo
 * detienen — pero la tabla de caracterización del módulo queda desmentida
 * por el propio fixture, que es el punto.
 *
 * AC 22 — "el parseo aguanta basura": JSON inválido, vacío, truncado a 4096 y
 * de forma desconocida degradan a la señal más gruesa, NO tiran, y la
 * matrícula se escribe igual. Un test por cada uno de los cuatro casos.
 */
import { describe, it, expect } from "vitest";
import {
  parseSuspendData,
  SCORM_SUSPEND_DATA_MAX_LENGTH,
} from "../../../../convex/lms/suspendData";
import {
  SUSPEND_DATA_SAMPLES_264,
  REAL_SCO_STATES,
} from "../../../fixtures/scormRealSamples2026-09-04";

// ============================================================================
// AC 17 — caracterización contra las muestras reales
// ============================================================================
describe("parseSuspendData — AC 17: caracterizado contra las 264 muestras reales", () => {
  it("el fixture ES el volcado: exactamente 264 muestras", () => {
    // Si este número cambia, el fixture dejó de ser el volcado del 2026-09-04
    // y toda la justificación de arriba deja de aplicar.
    expect(SUSPEND_DATA_SAMPLES_264).toHaveLength(264);
  });

  it("las 264 parsean como forma canónica — 0 fallas, 0 formas desconocidas", () => {
    const shapes = SUSPEND_DATA_SAMPLES_264.map((s) => parseSuspendData(s).shape);
    const canonical = shapes.filter((s) => s === "canonical").length;
    expect(canonical).toBe(264);
    expect(shapes.filter((s) => s !== "canonical")).toEqual([]);
  });

  it("las 264 tienen exactamente las dos claves {done, actual}, y ninguna otra", () => {
    // Medido sobre el crudo, no sobre la salida del parser: el parser podría
    // estar ignorando una tercera clave sin que se note.
    const keysets = new Set(
      SUSPEND_DATA_SAMPLES_264.map((s) =>
        Object.keys(JSON.parse(s) as Record<string, unknown>)
          .sort()
          .join(",")
      )
    );
    expect(Array.from(keysets)).toEqual(["actual,done"]);
  });

  it("`done` sólo trae enteros >= 0 (0..7 en el volcado) y `actual` enteros 0..8", () => {
    const doneValues = new Set<number>();
    const actualValues = new Set<number>();
    for (const sample of SUSPEND_DATA_SAMPLES_264) {
      const parsed = parseSuspendData(sample);
      parsed.done.forEach((d) => doneValues.add(d));
      expect(parsed.actual).not.toBeNull();
      actualValues.add(parsed.actual as number);
    }
    expect(Math.min(...doneValues)).toBe(0);
    expect(Math.max(...doneValues)).toBe(7);
    expect(Math.min(...actualValues)).toBe(0);
    expect(Math.max(...actualValues)).toBe(8);
  });

  it("ninguna muestra real se acerca al tope de 4096 (máximo observado: 37 bytes)", () => {
    // Éste es el dato que justifica NO escribir un rescate de truncado:
    // sería código contra una forma que nunca ocurrió.
    const longest = Math.max(...SUSPEND_DATA_SAMPLES_264.map((s) => s.length));
    expect(longest).toBe(37);
    expect(longest).toBeLessThan(SCORM_SUSPEND_DATA_MAX_LENGTH);
  });

  it("`done` vacío en 167 de las 264 — por eso `advanced` NO puede mirar sólo `done`", () => {
    const parsed = SUSPEND_DATA_SAMPLES_264.map((s) => parseSuspendData(s));
    expect(parsed.filter((p) => p.done.length === 0)).toHaveLength(167);
    // Y de esas, muchas SÍ avanzaron: `actual > 0` con `done` vacío.
    const doneVacioPeroAvanzo = parsed.filter(
      (p) => p.done.length === 0 && p.advanced
    );
    expect(doneVacioPeroAvanzo.length).toBeGreaterThan(0);
  });

  it("el caso real de Nati: `done` vacío y `actual` en 5, y aun así `advanced`", () => {
    // ITEM_UNIDAD_01 de la matrícula de Nati, tal cual quedó en la base.
    const signal = parseSuspendData(
      REAL_SCO_STATES.nati.ITEM_UNIDAD_01.suspendData
    );
    expect(signal.shape).toBe("canonical");
    expect(signal.done).toEqual([]);
    expect(signal.actual).toBe(5);
    expect(signal.touched).toBe(true);
    expect(signal.advanced).toBe(true);
  });

  it("los 18 scoStates reales parsean todos como canónicos", () => {
    const all = Object.values(REAL_SCO_STATES).flatMap((states) =>
      Object.values(states as Record<string, { suspendData?: string }>)
    );
    expect(all).toHaveLength(18);
    for (const state of all) {
      expect(parseSuspendData(state.suspendData).shape).toBe("canonical");
    }
  });
});

// ============================================================================
// AC 22 — el parseo aguanta basura y nunca tira
// ============================================================================
describe("parseSuspendData — AC 22: degrada, nunca tira", () => {
  it("caso 1/4 — JSON inválido: shape `invalid`, degrada a `touched`, no tira", () => {
    const basura = ["{no es json", "}{", "undefined", "{'done': []}", "\\x00"];
    for (const raw of basura) {
      const signal = parseSuspendData(raw);
      expect(signal.shape).toBe("invalid");
      // Señal más gruesa disponible: el SCO escribió algo.
      expect(signal.touched).toBe(true);
      expect(signal.done).toEqual([]);
      expect(signal.actual).toBeNull();
      expect(signal.advanced).toBe(false);
    }
  });

  it("caso 2/4 — vacío: cadena vacía, espacios, null y undefined", () => {
    expect(parseSuspendData("").shape).toBe("empty");
    expect(parseSuspendData("   \n\t ").shape).toBe("empty");
    // Vacío = el SCO escribió sin contenido; ausente = nunca escribió.
    expect(parseSuspendData("").touched).toBe(true);
    expect(parseSuspendData(null).shape).toBe("absent");
    expect(parseSuspendData(undefined).shape).toBe("absent");
    expect(parseSuspendData(undefined).touched).toBe(false);
    for (const raw of ["", "   ", null, undefined]) {
      expect(parseSuspendData(raw).done).toEqual([]);
      expect(parseSuspendData(raw).actual).toBeNull();
      expect(parseSuspendData(raw).advanced).toBe(false);
    }
  });

  it("caso 3/4 — truncado a 4096: no parsea, degrada a `touched`, no tira", () => {
    // Un payload canónico grande, cortado en seco en el tope de SCORM 1.2:
    // exactamente lo que hace un LMS que respeta el límite de la norma.
    const grande = JSON.stringify({
      done: Array.from({ length: 2000 }, (_, i) => i),
      actual: 2000,
    });
    expect(grande.length).toBeGreaterThan(SCORM_SUSPEND_DATA_MAX_LENGTH);
    const truncado = grande.slice(0, SCORM_SUSPEND_DATA_MAX_LENGTH);
    expect(truncado).toHaveLength(4096);

    const signal = parseSuspendData(truncado);
    expect(signal.shape).toBe("invalid");
    expect(signal.touched).toBe(true);
    expect(signal.done).toEqual([]);
    expect(signal.actual).toBeNull();
  });

  it("caso 4/4 — forma desconocida: JSON válido que no es el objeto esperado", () => {
    // JSON válido pero de otra forma: array, número, cadena, null, objeto sin
    // ninguna de las dos claves.
    for (const raw of ['["a","b"]', "42", '"hola"', "null", '{"otra":1}']) {
      const signal = parseSuspendData(raw);
      expect(signal.shape).toBe("unknown");
      expect(signal.touched).toBe(true);
      expect(signal.done).toEqual([]);
      expect(signal.actual).toBeNull();
      expect(signal.advanced).toBe(false);
    }
  });

  it("forma PARCIAL — falta una clave o no tipa: se usa lo que sí sirve", () => {
    // Sólo `actual`: la señal de posición se conserva.
    const soloActual = parseSuspendData('{"actual":3}');
    expect(soloActual.shape).toBe("partial");
    expect(soloActual.actual).toBe(3);
    expect(soloActual.advanced).toBe(true);

    // Sólo `done`.
    const soloDone = parseSuspendData('{"done":[0,1]}');
    expect(soloDone.shape).toBe("partial");
    expect(soloDone.done).toEqual([0, 1]);
    expect(soloDone.actual).toBeNull();
    expect(soloDone.advanced).toBe(true);

    // Tipos equivocados: `done` no es array, `actual` no es entero.
    const tiposMal = parseSuspendData('{"done":"0,1","actual":"3"}');
    expect(tiposMal.shape).toBe("partial");
    expect(tiposMal.done).toEqual([]);
    expect(tiposMal.actual).toBeNull();
    expect(tiposMal.advanced).toBe(false);
  });

  it("`done` sucio se sanea: descarta no-índices, deduplica y ordena", () => {
    const signal = parseSuspendData(
      '{"done":[3,1,1,-2,"x",2.5,null,0],"actual":3}'
    );
    // Quedan sólo enteros >= 0, únicos, ascendentes.
    expect(signal.done).toEqual([0, 1, 3]);
    expect(signal.actual).toBe(3);
    // Hubo descarte -> no es canónico.
    expect(signal.shape).toBe("partial");
  });

  it("NINGUNA entrada hace tirar al parser — barrido de entradas hostiles", () => {
    const hostiles: Array<string | null | undefined> = [
      "",
      " ",
      "{",
      "[",
      "null",
      "NaN",
      "Infinity",
      '{"done":',
      '{"done":[1,2,',
      '{"actual":-1}',
      '{"actual":1.5}',
      '{"done":[[[[[[]]]]]]}',
      " ",
      "0".repeat(SCORM_SUSPEND_DATA_MAX_LENGTH),
      JSON.stringify({ done: [1], actual: 1, extra: { anidado: true } }),
      null,
      undefined,
    ];
    for (const raw of hostiles) {
      expect(() => parseSuspendData(raw)).not.toThrow();
      const signal = parseSuspendData(raw);
      // El contrato mínimo se cumple SIEMPRE: `done` es array, `actual` es
      // número o null. El consumidor nunca tiene que defenderse.
      expect(Array.isArray(signal.done)).toBe(true);
      expect(signal.actual === null || typeof signal.actual === "number").toBe(
        true
      );
    }
  });
});
