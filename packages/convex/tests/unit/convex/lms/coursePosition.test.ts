/**
 * Tests de convex/lms/coursePosition.ts — T-be-002.
 *
 * Cubren AC 18 y AC 19 de SPEC-CUENTA-ALUMNA-2026-09-04 v1.2, con la regla de
 * derivación del hallazgo H-6 (que corrige §3.6 de la spec: el módulo NO sale
 * de `actual`).
 *
 * AC 18 — "la señal de avance se mueve al cursar. Verificado contra el caso
 * real: `done` vacío y `actual` en 5. Un criterio que sólo pase con `done`
 * poblado no cumple este AC." Por eso el caso de Nati se corre contra su
 * `scoStates` REAL, importado del volcado, y no contra un ejemplo inventado.
 *
 * AC 19 — "nada dice completo si algún SCO no lo está. Test con 6 de 7
 * completos y el séptimo a medias."
 */
import { describe, it, expect } from "vitest";
import { deriveCoursePosition } from "../../../../convex/lms/coursePosition";
import { extractScoIds } from "../../../../convex/lms/scoStructure";
import {
  REAL_SCO_STATES,
  REAL_SCO_STRUCTURE,
} from "../../../fixtures/scormRealSamples2026-09-04";

// El curso real, tal como quedó en la base. Siete ítems SCO.
const CURSO_REAL = REAL_SCO_STRUCTURE as unknown;

/** scoStates sintético a partir de la lista de ítems del curso real. */
const scoStatesDe = (
  entries: Array<[string, { lessonStatus?: string; suspendData?: string }]>
): Record<string, { lessonStatus?: string; suspendData?: string }> =>
  Object.fromEntries(entries);

const IDS = extractScoIds(CURSO_REAL);

// ============================================================================
// La estructura del curso real — el "de 7" no es una cifra de ilustración
// ============================================================================
describe("scoStructure del curso real", () => {
  it("declara 7 módulos SCO, en el orden del manifiesto", () => {
    expect(IDS).toEqual([
      "ITEM_PRESENTACION",
      "ITEM_UNIDAD_01",
      "ITEM_UNIDAD_02",
      "ITEM_UNIDAD_03",
      "ITEM_UNIDAD_04",
      "ITEM_UNIDAD_05",
      "ITEM_RECURSOS",
    ]);
  });

  it("RES_SHARED es un asset, no un SCO — y no cuenta como módulo", () => {
    // Si algún día contara, el denominador de la alumna (7) y el de
    // progressPercent dejarían de coincidir.
    expect(IDS).toHaveLength(7);
  });
});

// ============================================================================
// AC 18 — la señal se mueve al cursar, con `done` vacío
// ============================================================================
describe("deriveCoursePosition — AC 18: se mueve al cursar", () => {
  it("EL CASO DE NATI, con sus datos reales: Módulo 5 de 7 · en curso", () => {
    const position = deriveCoursePosition(REAL_SCO_STATES.nati, CURSO_REAL);
    expect(position.moduleIndex).toBe(5);
    expect(position.moduleTotal).toBe(7);
    expect(position.moduleTitle).toBe("Cierre del curso");
    expect(position.state).toBe("in-progress");
  });

  it("y lo da con `done` vacío en el 100% de las muestras de Nati", () => {
    // Ésta es la mitad del AC 18 que un criterio basado en `done` reprueba:
    // se verifica que efectivamente NO hay ni una página marcada como hecha.
    const suspendDatas = Object.values(
      REAL_SCO_STATES.nati as Record<string, { suspendData?: string }>
    ).map((s) => JSON.parse(s.suspendData ?? "{}") as { done: number[] });
    expect(suspendDatas).toHaveLength(5);
    for (const sd of suspendDatas) expect(sd.done).toEqual([]);
    // Y aun así la posición no es cero.
    expect(deriveCoursePosition(REAL_SCO_STATES.nati, CURSO_REAL).moduleIndex)
      .toBe(5);
  });

  it("la señal SE MUEVE: de recién matriculada a Nati hay 0 -> 5", () => {
    // El estado inicial real de las otras seis matrículas del volcado:
    // scoStates vacío.
    const alPrincipio = deriveCoursePosition({}, CURSO_REAL);
    expect(alPrincipio.moduleIndex).toBe(0);
    expect(alPrincipio.state).toBe("not-started");
    expect(alPrincipio.moduleTitle).toBeNull();

    const despues = deriveCoursePosition(REAL_SCO_STATES.nati, CURSO_REAL);
    expect(despues.moduleIndex).toBeGreaterThan(alPrincipio.moduleIndex);
  });

  it("caso real de Marcos: 5 SCOs tocados, `done` vacío -> Módulo 5 de 7", () => {
    const position = deriveCoursePosition(REAL_SCO_STATES.marcos, CURSO_REAL);
    expect(position.moduleIndex).toBe(5);
    expect(position.state).toBe("in-progress");
  });

  it("caso real de Tomás: `done` poblado hasta 8 -> también Módulo 5 de 7", () => {
    // El camino "bueno" (navegación interna del SCO) da la MISMA posición que
    // el camino de las testers: la derivación no premia ni castiga la forma
    // de navegar, sólo dice por dónde va.
    const position = deriveCoursePosition(REAL_SCO_STATES.tomas, CURSO_REAL);
    expect(position.moduleIndex).toBe(5);
    expect(position.moduleTotal).toBe(7);
  });

  it("caso real de zephyracs: scoStates NO CONTIGUO -> manda el más avanzado", () => {
    // Tiene ITEM_UNIDAD_01, ITEM_UNIDAD_03 e ITEM_RECURSOS (el 7º). Contar
    // claves daría 3; la regla H-6 dice "el más avanzado presente" = 7.
    const position = deriveCoursePosition(REAL_SCO_STATES.zephyracs, CURSO_REAL);
    expect(position.moduleIndex).toBe(7);
    expect(position.moduleTitle).toBe("Recursos");
    // Llegó al último módulo pero NO terminó el curso.
    expect(position.state).toBe("in-progress");
  });

  it("`actual` NO entra en el numerador", () => {
    // Mismo SCO tocado (el primero), `actual` en 0 o en 99: la posición es 1
    // en los dos casos. Si `actual` se colara al numerador, esto se rompería.
    const enCero = deriveCoursePosition(
      scoStatesDe([["ITEM_PRESENTACION", { suspendData: '{"done":[],"actual":0}' }]]),
      CURSO_REAL
    );
    const enNoventaYNueve = deriveCoursePosition(
      scoStatesDe([
        ["ITEM_PRESENTACION", { suspendData: '{"done":[],"actual":99}' }],
      ]),
      CURSO_REAL
    );
    expect(enCero.moduleIndex).toBe(1);
    expect(enNoventaYNueve.moduleIndex).toBe(1);
    // Lo único que `actual` mueve es el matiz de "tocado".
    expect(enCero.moduleTouched).toBe(false);
    expect(enNoventaYNueve.moduleTouched).toBe(true);
  });
});

// ============================================================================
// AC 19 — nada dice "completo" si algún SCO no lo está
// ============================================================================
describe("deriveCoursePosition — AC 19: el invariante de completitud", () => {
  it("6 de 7 completos y el séptimo a medias -> NO es `completed`", () => {
    const estados = scoStatesDe([
      ...IDS.slice(0, 6).map(
        (id) =>
          [id, { lessonStatus: "completed", suspendData: '{"done":[0],"actual":1}' }] as [
            string,
            { lessonStatus?: string; suspendData?: string },
          ]
      ),
      // El séptimo: abierto, avanzando, sin terminar.
      [IDS[6], { lessonStatus: "incomplete", suspendData: '{"done":[],"actual":2}' }],
    ]);
    const position = deriveCoursePosition(estados, CURSO_REAL);
    expect(position.state).toBe("in-progress");
    expect(position.state).not.toBe("completed");
    expect(position.moduleIndex).toBe(7);
    expect(position.moduleTotal).toBe(7);
  });

  it("6 de 7 completos y el séptimo NUNCA ABIERTO -> tampoco es `completed`", () => {
    // El borde que un barrido sobre las claves de scoStates (en vez de sobre
    // la lista del curso) se comería: si sólo mirás lo que existe en
    // scoStates, seis de seis dan "todos completos" y el curso miente.
    const estados = scoStatesDe(
      IDS.slice(0, 6).map((id) => [id, { lessonStatus: "completed" }])
    );
    const position = deriveCoursePosition(estados, CURSO_REAL);
    expect(position.state).toBe("in-progress");
    expect(position.moduleIndex).toBe(6);
  });

  it("los 7 completos -> `completed`, Módulo 7 de 7", () => {
    const estados = scoStatesDe(
      IDS.map((id) => [id, { lessonStatus: "completed" }])
    );
    const position = deriveCoursePosition(estados, CURSO_REAL);
    expect(position.state).toBe("completed");
    expect(position.moduleIndex).toBe(7);
    expect(position.moduleTotal).toBe(7);
  });

  it("`passed` cuenta como terminal, igual que en scormEvents", () => {
    const estados = scoStatesDe(
      IDS.map((id) => [id, { lessonStatus: "passed" }])
    );
    expect(deriveCoursePosition(estados, CURSO_REAL).state).toBe("completed");
  });

  it("`failed` NO cuenta como terminal", () => {
    const estados = scoStatesDe(
      IDS.map((id, i) => [
        id,
        { lessonStatus: i === 3 ? "failed" : "completed" },
      ])
    );
    expect(deriveCoursePosition(estados, CURSO_REAL).state).toBe("in-progress");
  });
});

// ============================================================================
// Bordes que los datos reales ya muestran, y bordes de runtime
// ============================================================================
describe("deriveCoursePosition — bordes", () => {
  it("un SCO SIN `lessonStatus` (ITEM_PRESENTACION real) no rompe nada", () => {
    // En la base, ITEM_PRESENTACION de Nati y de Tomás tiene sólo
    // `suspendData`. La derivación no puede asumir que la clave existe.
    const presentacionDeNati = (
      REAL_SCO_STATES.nati as Record<string, { lessonStatus?: string }>
    ).ITEM_PRESENTACION;
    expect(presentacionDeNati.lessonStatus).toBeUndefined();

    const position = deriveCoursePosition(
      scoStatesDe([["ITEM_PRESENTACION", presentacionDeNati]]),
      CURSO_REAL
    );
    expect(position.moduleIndex).toBe(1);
    expect(position.state).toBe("in-progress");
  });

  it("claves de scoStates que NO pertenecen al curso se ignoran", () => {
    // Puede pasar tras una re-ingesta que cambió los identificadores: la
    // matrícula vieja apunta a un curso archivado, pero si alguien la
    // repuntara, el denominador tiene que seguir mandando.
    const position = deriveCoursePosition(
      scoStatesDe([["ITEM_DE_OTRO_CURSO", { lessonStatus: "completed" }]]),
      CURSO_REAL
    );
    expect(position.moduleIndex).toBe(0);
    expect(position.moduleTotal).toBe(7);
    expect(position.state).toBe("not-started");
  });

  it("curso SIN scoStructure: total 0, sin `Módulo 0 de 0` inventado", () => {
    expect(deriveCoursePosition({}, undefined)).toMatchObject({
      moduleIndex: 0,
      moduleTotal: 0,
      moduleTitle: null,
      state: "not-started",
    });
    // Con estado pero sin estructura: entró a algo, no sabemos numerarlo.
    expect(
      deriveCoursePosition(scoStatesDe([["X", {}]]), undefined).state
    ).toBe("in-progress");
  });

  it("NUNCA lanza — scoStates y scoStructure son v.any() en el schema", () => {
    const basuras: unknown[] = [
      null,
      undefined,
      0,
      "",
      "texto",
      [],
      [1, 2, 3],
      { organizations: null },
      { organizations: { items: "no soy un array" } },
      { organizations: { items: [{}] }, resources: null },
      true,
    ];
    for (const estados of basuras) {
      for (const estructura of basuras) {
        expect(() => deriveCoursePosition(estados, estructura)).not.toThrow();
        const position = deriveCoursePosition(estados, estructura);
        // El contrato mínimo se cumple siempre.
        expect(position.moduleIndex).toBeGreaterThanOrEqual(0);
        expect(position.moduleIndex).toBeLessThanOrEqual(position.moduleTotal);
      }
    }
  });

  it("NO expone ningún porcentaje — riesgo S9", () => {
    // Guarda explícita: si alguien agrega `progressPercent` o `percent` a este
    // contrato, este test cae y obliga a releer S9 antes de estrenar.
    const position = deriveCoursePosition(REAL_SCO_STATES.nati, CURSO_REAL);
    expect(Object.keys(position).sort()).toEqual([
      "moduleIndex",
      "moduleTitle",
      "moduleTotal",
      "moduleTouched",
      "state",
    ]);
  });
});
