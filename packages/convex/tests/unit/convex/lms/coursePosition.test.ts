/**
 * Tests de convex/lms/coursePosition.ts — T-be-002 / T-be-002b.
 *
 * Cubren AC 18 y AC 19 de SPEC-CUENTA-ALUMNA-2026-09-04 v1.2.
 *
 * AC 18 — "la señal de avance se mueve al cursar. Verificado contra el caso
 * real: `done` vacío y `actual` en 5. Un criterio que sólo pase con `done`
 * poblado no cumple este AC." Por eso el caso de Nati se corre contra su
 * `scoStates` REAL, importado del volcado, y no contra un ejemplo inventado.
 *
 * AC 19 — "nada dice completo si algún SCO no lo está. Test con 6 de 7
 * completos y el séptimo a medias."
 *
 * CAMBIO DE REGLA (Tomás, 2026-09-07): la señal pasó de ser la POSICIÓN del
 * SCO más avanzado (hallazgo H-6) al CONTEO de módulos vistos. El test
 * "scoStates NO CONTIGUO" de abajo es el que cambió de sentido y el que
 * motivó la decisión — ver su comentario.
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

  it("ITEM_RECURSOS ES un SCO — RES_SHARED es el único asset del paquete", () => {
    // Verificado contra el manifiesto real: los siete ítems apuntan a
    // recursos con scormType "sco". Por eso el total es 7 y no 6, y por eso
    // "Recursos" cuenta como un módulo más y no como un anexo.
    expect(IDS).toHaveLength(7);
    expect(IDS).toContain("ITEM_RECURSOS");
  });
});

// ============================================================================
// AC 18 — la señal se mueve al cursar, con `done` vacío
// ============================================================================
describe("deriveCoursePosition — AC 18: se mueve al cursar", () => {
  it("EL CASO DE NATI, con sus datos reales: 5 de 7 módulos vistos", () => {
    const position = deriveCoursePosition(REAL_SCO_STATES.nati, CURSO_REAL);
    expect(position.modulesSeen).toBe(5);
    expect(position.moduleTotal).toBe(7);
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
    // Y aun así el conteo no es cero.
    expect(
      deriveCoursePosition(REAL_SCO_STATES.nati, CURSO_REAL).modulesSeen
    ).toBe(5);
  });

  it("la señal SE MUEVE: de recién matriculada a Nati hay 0 -> 5", () => {
    // El estado inicial real de las otras seis matrículas del volcado:
    // scoStates vacío.
    const alPrincipio = deriveCoursePosition({}, CURSO_REAL);
    expect(alPrincipio.modulesSeen).toBe(0);
    expect(alPrincipio.state).toBe("not-started");

    const despues = deriveCoursePosition(REAL_SCO_STATES.nati, CURSO_REAL);
    expect(despues.modulesSeen).toBeGreaterThan(alPrincipio.modulesSeen);
  });

  it("caso real de Marcos: 5 módulos vistos, `done` vacío -> 5 de 7", () => {
    const position = deriveCoursePosition(REAL_SCO_STATES.marcos, CURSO_REAL);
    expect(position.modulesSeen).toBe(5);
    expect(position.state).toBe("in-progress");
  });

  it("caso real de Tomás: `done` poblado hasta 8 -> también 5 de 7", () => {
    // El camino "bueno" (navegación interna del SCO) da el MISMO conteo que el
    // camino de las testers: la señal cuenta módulos vistos, no premia ni
    // castiga la forma de navegar dentro de cada uno.
    const position = deriveCoursePosition(REAL_SCO_STATES.tomas, CURSO_REAL);
    expect(position.modulesSeen).toBe(5);
    expect(position.moduleTotal).toBe(7);
    // Lo que sí lo distingue de Nati: Tomás avanzó DENTRO de los módulos.
    expect(position.anyModuleAdvanced).toBe(true);
  });

  it("`actual` NO entra en el conteo", () => {
    // Mismo módulo visto, `actual` en 0 o en 99: el conteo es 1 en los dos
    // casos. Si `actual` se colara al conteo, esto se rompería.
    const enCero = deriveCoursePosition(
      scoStatesDe([
        ["ITEM_PRESENTACION", { suspendData: '{"done":[],"actual":0}' }],
      ]),
      CURSO_REAL
    );
    const enNoventaYNueve = deriveCoursePosition(
      scoStatesDe([
        ["ITEM_PRESENTACION", { suspendData: '{"done":[],"actual":99}' }],
      ]),
      CURSO_REAL
    );
    expect(enCero.modulesSeen).toBe(1);
    expect(enNoventaYNueve.modulesSeen).toBe(1);
    // Lo único que `actual` mueve es el matiz de "se movió dentro de alguno".
    expect(enCero.anyModuleAdvanced).toBe(false);
    expect(enNoventaYNueve.anyModuleAdvanced).toBe(true);
  });
});

// ============================================================================
// T-be-002b — la señal cuenta módulos vistos, no el más lejano
// ============================================================================
describe("deriveCoursePosition — el conteo y sus tres propiedades", () => {
  it("scoStates NO CONTIGUO: `zephyracs` da 3 de 7, NO 7 de 7", () => {
    // ESTE TEST CAMBIÓ DE SENTIDO, no se agregó.
    //
    // Antes fijaba la regla de POSICIÓN del hallazgo H-6: "el módulo es la
    // posición del SCO más avanzado presente", y por lo tanto esperaba 7,
    // porque esta matrícula real tiene ITEM_RECURSOS, que es el séptimo y
    // último ítem del curso.
    //
    // Pero `zephyracs` sólo tiene ITEM_UNIDAD_01, ITEM_UNIDAD_03 e
    // ITEM_RECURSOS: salteó cuatro unidades. Decirle "7 de 7" era decirle que
    // había recorrido el curso entero, que es justo el malentendido que este
    // sprint vino a arreglar.
    //
    // DECISIÓN DE TOMÁS, 2026-09-07: la señal pasa a ser conteo de módulos
    // vistos. La expectativa se invierte de 7 a 3, que es lo que esta persona
    // efectivamente vio.
    const position = deriveCoursePosition(REAL_SCO_STATES.zephyracs, CURSO_REAL);
    expect(position.modulesSeen).toBe(3);
    expect(position.moduleTotal).toBe(7);
    expect(position.state).toBe("in-progress");
  });

  it("NO PREMIA EL SALTO: tocar el último módulo suma lo mismo que el primero", () => {
    const soloElPrimero = deriveCoursePosition(
      scoStatesDe([[IDS[0], {}]]),
      CURSO_REAL
    );
    const soloElUltimo = deriveCoursePosition(
      scoStatesDe([[IDS[6], {}]]),
      CURSO_REAL
    );
    expect(soloElPrimero.modulesSeen).toBe(1);
    expect(soloElUltimo.modulesSeen).toBe(1);
    // Y no hay ningún atajo: para llegar a 7 hay que haber visto los 7.
    expect(
      deriveCoursePosition(
        scoStatesDe(IDS.map((id) => [id, {}])),
        CURSO_REAL
      ).modulesSeen
    ).toBe(7);
  });

  it("NO RETROCEDE: agregar módulos al mapa nunca baja el conteo", () => {
    // recordScormEvent hace `{...prevScoStates}` y agrega, nunca borra, así
    // que la única evolución posible de scoStates es crecer. Se simula esa
    // evolución y se exige monotonía en cada paso.
    const acumulado: Array<[string, { lessonStatus?: string }]> = [];
    let anterior = -1;
    // En un orden deliberadamente caótico, para que la monotonía no dependa
    // de que la alumna curse ordenada.
    for (const i of [3, 0, 6, 1, 5, 2, 4]) {
      acumulado.push([IDS[i], { lessonStatus: "incomplete" }]);
      const actual = deriveCoursePosition(
        scoStatesDe(acumulado),
        CURSO_REAL
      ).modulesSeen;
      expect(actual).toBeGreaterThan(anterior);
      anterior = actual;
    }
    expect(anterior).toBe(7);
  });

  it("SÓLO CUENTA EL MANIFIESTO: claves ajenas al curso no suman", () => {
    // El caso que schema.ts advierte en `lmsEnrollments.scoStates`: un curso
    // re-ingestado puede traer otra estructura. Sin este filtro, `modulesSeen`
    // podría superar a `moduleTotal` y la copia diría "9 de 7".
    const position = deriveCoursePosition(
      scoStatesDe([
        [IDS[0], {}],
        ["ITEM_DE_OTRO_CURSO", { lessonStatus: "completed" }],
        ["ITEM_DE_OTRO_CURSO_2", { lessonStatus: "completed" }],
      ]),
      CURSO_REAL
    );
    expect(position.modulesSeen).toBe(1);
    expect(position.moduleTotal).toBe(7);
  });

  it("SÓLO claves ajenas: no empezó este curso", () => {
    const position = deriveCoursePosition(
      scoStatesDe([["ITEM_DE_OTRO_CURSO", { lessonStatus: "completed" }]]),
      CURSO_REAL
    );
    expect(position.modulesSeen).toBe(0);
    expect(position.moduleTotal).toBe(7);
    expect(position.state).toBe("not-started");
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
          [
            id,
            { lessonStatus: "completed", suspendData: '{"done":[0],"actual":1}' },
          ] as [string, { lessonStatus?: string; suspendData?: string }]
      ),
      // El séptimo: abierto, avanzando, sin terminar.
      [
        IDS[6],
        { lessonStatus: "incomplete", suspendData: '{"done":[],"actual":2}' },
      ],
    ]);
    const position = deriveCoursePosition(estados, CURSO_REAL);
    expect(position.state).toBe("in-progress");
    expect(position.state).not.toBe("completed");
    // Los vio a los 7 — pero verlos no es terminarlos.
    expect(position.modulesSeen).toBe(7);
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
    expect(position.modulesSeen).toBe(6);
  });

  it("los 7 completos -> `completed`, 7 de 7", () => {
    const estados = scoStatesDe(
      IDS.map((id) => [id, { lessonStatus: "completed" }])
    );
    const position = deriveCoursePosition(estados, CURSO_REAL);
    expect(position.state).toBe("completed");
    expect(position.modulesSeen).toBe(7);
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
    expect(position.modulesSeen).toBe(1);
    expect(position.state).toBe("in-progress");
  });

  it("curso SIN scoStructure: total 0, sin `0 de 0` inventado", () => {
    expect(deriveCoursePosition({}, undefined)).toMatchObject({
      modulesSeen: 0,
      moduleTotal: 0,
      state: "not-started",
    });
    // Con estado pero sin estructura: entró a algo, no sabemos contra qué
    // contarlo.
    expect(deriveCoursePosition(scoStatesDe([["X", {}]]), undefined).state).toBe(
      "in-progress"
    );
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
        expect(position.modulesSeen).toBeGreaterThanOrEqual(0);
        expect(position.modulesSeen).toBeLessThanOrEqual(position.moduleTotal);
      }
    }
  });

  it("NO expone ningún porcentaje, ni título de módulo — riesgo S9", () => {
    // Guarda explícita del contrato. `moduleTitle` se sacó a propósito
    // (T-be-002b): con un conteo no hay "módulo en el que estás", y el único
    // título derivable sin inventar sería el último EN ORDEN DE MANIFIESTO,
    // que para `zephyracs` diría "Recursos" — la misma señal engañosa que se
    // acaba de sacar, mudada de campo.
    const position = deriveCoursePosition(REAL_SCO_STATES.nati, CURSO_REAL);
    expect(Object.keys(position).sort()).toEqual([
      "anyModuleAdvanced",
      "moduleTotal",
      "modulesSeen",
      "state",
    ]);
  });
});
