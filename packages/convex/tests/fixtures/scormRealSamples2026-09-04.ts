/**
 * FIXTURE - muestras REALES de staging, volcadas antes del reset del
 * 2026-09-04. Generado desde `evidence/reset-2026-09-04/`
 * (`snapshot-pre-reset-2026-09-04.zip`), que es IRREPRODUCIBLE: la base de
 * staging se reseteo ese mismo dia.
 *
 * Existe para que AC 17 ("el formato esta caracterizado y el parseo se
 * justifica contra datos; no se parsea sobre una suposicion") y AC 18 ("la
 * senal se mueve al cursar, verificado contra el caso real: `done` vacio y
 * `actual` en 5") se verifiquen contra los bytes reales y no contra un
 * ejemplo escrito a mano por quien programo el parser.
 *
 * NO EDITAR A MANO. Si hace falta regenerarlo, sale del zip de evidencia.
 */

/** Las 264 escrituras de `cmi.suspend_data` de `lmsScormEvents` (H-7: sin `scoId`; sirven para el parser, no para atribuir SCO). */
export const SUSPEND_DATA_SAMPLES_264: readonly string[] = [
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[0,1,2,3,4,5,6,7],\"actual\":8}",
  "{\"done\":[0],\"actual\":0}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[0,1,2],\"actual\":2}",
  "{\"done\":[0,1,2,3,4,5,6,7],\"actual\":8}",
  "{\"done\":[],\"actual\":4}",
  "{\"done\":[0,1,2],\"actual\":2}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[0],\"actual\":0}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[],\"actual\":6}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[],\"actual\":4}",
  "{\"done\":[],\"actual\":5}",
  "{\"done\":[0,1,2],\"actual\":2}",
  "{\"done\":[0,1,2,3,4,5,6,7],\"actual\":8}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[],\"actual\":4}",
  "{\"done\":[0],\"actual\":0}",
  "{\"done\":[0,1,2,3,4,5,6,7],\"actual\":7}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[0],\"actual\":0}",
  "{\"done\":[3],\"actual\":3}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[0],\"actual\":0}",
  "{\"done\":[],\"actual\":6}",
  "{\"done\":[],\"actual\":1}",
  "{\"done\":[0,1,2,3,4,5,6,7],\"actual\":8}",
  "{\"done\":[],\"actual\":4}",
  "{\"done\":[0,1,2],\"actual\":2}",
  "{\"done\":[0,1,2,3,4,5,6,7],\"actual\":8}",
  "{\"done\":[],\"actual\":5}",
  "{\"done\":[],\"actual\":4}",
  "{\"done\":[],\"actual\":6}",
  "{\"done\":[],\"actual\":1}",
  "{\"done\":[0,1,2],\"actual\":2}",
  "{\"done\":[],\"actual\":1}",
  "{\"done\":[],\"actual\":4}",
  "{\"done\":[0,1,2,3,4,5,6,7],\"actual\":8}",
  "{\"done\":[0,1,2],\"actual\":2}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[],\"actual\":4}",
  "{\"done\":[0,1,2,3,4,5,6,7],\"actual\":8}",
  "{\"done\":[0,1],\"actual\":1}",
  "{\"done\":[0,1],\"actual\":2}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[0,1,2],\"actual\":2}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[0],\"actual\":0}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[0,1,2,3,4,5,6,7],\"actual\":8}",
  "{\"done\":[0],\"actual\":1}",
  "{\"done\":[],\"actual\":5}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[0,1,2],\"actual\":2}",
  "{\"done\":[0,1],\"actual\":2}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[],\"actual\":4}",
  "{\"done\":[0,1,2],\"actual\":2}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[],\"actual\":4}",
  "{\"done\":[0],\"actual\":0}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[],\"actual\":4}",
  "{\"done\":[],\"actual\":1}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[],\"actual\":4}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[0,1,2,3,4,5,6,7],\"actual\":8}",
  "{\"done\":[0],\"actual\":0}",
  "{\"done\":[3],\"actual\":2}",
  "{\"done\":[0,1,2],\"actual\":2}",
  "{\"done\":[0],\"actual\":0}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[],\"actual\":4}",
  "{\"done\":[0,1,2],\"actual\":2}",
  "{\"done\":[],\"actual\":4}",
  "{\"done\":[0,1,2,3,4,5,6],\"actual\":6}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[0,1,2,3,4,5,6,7],\"actual\":8}",
  "{\"done\":[0,1,2,3,4,5,6,7],\"actual\":8}",
  "{\"done\":[0],\"actual\":0}",
  "{\"done\":[],\"actual\":4}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[0,1,2],\"actual\":2}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[0],\"actual\":0}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[],\"actual\":6}",
  "{\"done\":[],\"actual\":1}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[0],\"actual\":0}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[0],\"actual\":0}",
  "{\"done\":[0,1,2,3,4,5,6,7],\"actual\":8}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[],\"actual\":6}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[3],\"actual\":2}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[0,1,2],\"actual\":3}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[0,1,2],\"actual\":2}",
  "{\"done\":[0],\"actual\":0}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[3],\"actual\":2}",
  "{\"done\":[0],\"actual\":0}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[],\"actual\":4}",
  "{\"done\":[],\"actual\":4}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[0,1,2],\"actual\":2}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[0,1,2,3,4,5,6,7],\"actual\":8}",
  "{\"done\":[0],\"actual\":0}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[0],\"actual\":0}",
  "{\"done\":[],\"actual\":4}",
  "{\"done\":[],\"actual\":6}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[0,1,2,3,4,5,6,7],\"actual\":8}",
  "{\"done\":[0],\"actual\":0}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[],\"actual\":4}",
  "{\"done\":[0,1,2,3,4,5,6,7],\"actual\":8}",
  "{\"done\":[0,1,2,3,4,5,6,7],\"actual\":8}",
  "{\"done\":[],\"actual\":6}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[0],\"actual\":0}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[0,1,2,3,4,5,6],\"actual\":7}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[0,1,2],\"actual\":2}",
  "{\"done\":[0,1],\"actual\":1}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[],\"actual\":4}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[0],\"actual\":0}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[0,1,2],\"actual\":2}",
  "{\"done\":[0,1,2,3],\"actual\":3}",
  "{\"done\":[],\"actual\":4}",
  "{\"done\":[0],\"actual\":0}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[0,1,2,3,4,5,6,7],\"actual\":8}",
  "{\"done\":[],\"actual\":1}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[0,1,2,3,4,5,6,7],\"actual\":8}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[0],\"actual\":0}",
  "{\"done\":[0,1,2,3,4,5,6,7],\"actual\":8}",
  "{\"done\":[0],\"actual\":0}",
  "{\"done\":[],\"actual\":5}",
  "{\"done\":[0,1,2,3,4,5,6,7],\"actual\":8}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[0,1,2,3,4,5,6,7],\"actual\":8}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[0],\"actual\":0}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[],\"actual\":4}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[0,1,2,3,4,5],\"actual\":5}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[0],\"actual\":0}",
  "{\"done\":[],\"actual\":1}",
  "{\"done\":[],\"actual\":6}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[],\"actual\":5}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[],\"actual\":4}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[],\"actual\":5}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[],\"actual\":1}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[0,1,2],\"actual\":2}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[0],\"actual\":0}",
  "{\"done\":[0,1,2,3,4,5,6,7],\"actual\":8}",
  "{\"done\":[],\"actual\":1}",
  "{\"done\":[],\"actual\":6}",
  "{\"done\":[0,1,2,3,4,5,6,7],\"actual\":8}",
  "{\"done\":[0,1,2,3,4,5,6,7],\"actual\":8}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[],\"actual\":4}",
  "{\"done\":[0,1,2,3],\"actual\":4}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[0],\"actual\":0}",
  "{\"done\":[0,1,2,3,4,5,6,7],\"actual\":8}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[0],\"actual\":1}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[],\"actual\":5}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[0,1,2,3,4],\"actual\":4}",
  "{\"done\":[0,1,2],\"actual\":2}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[0],\"actual\":0}",
  "{\"done\":[],\"actual\":4}",
  "{\"done\":[0,1,2,3,4,5,6,7],\"actual\":8}",
  "{\"done\":[],\"actual\":4}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[0],\"actual\":0}",
  "{\"done\":[],\"actual\":5}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[],\"actual\":3}",
  "{\"done\":[],\"actual\":1}",
  "{\"done\":[],\"actual\":4}",
  "{\"done\":[],\"actual\":4}",
  "{\"done\":[0],\"actual\":0}",
  "{\"done\":[0,1,2,3,4,5,6,7],\"actual\":8}",
  "{\"done\":[0,1,2,3,4],\"actual\":5}",
  "{\"done\":[],\"actual\":4}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[0,1,2,3,4,5],\"actual\":6}",
  "{\"done\":[3],\"actual\":2}",
  "{\"done\":[0,1,2],\"actual\":2}",
  "{\"done\":[],\"actual\":0}",
  "{\"done\":[],\"actual\":2}",
  "{\"done\":[],\"actual\":2}",
];

/**
 * `scoStructure` del curso real publicado (`kh71mg2rk1znc6frbezqa4kx1s87y5ec`).
 * SIETE items SCO: el "de 7" del enunciado es este curso, no una cifra de
 * ilustracion. Recortado a los campos que la derivacion lee.
 */
export const REAL_SCO_STRUCTURE = {
  "organizations": {
    "items": [
      {
        "identifier": "ITEM_PRESENTACION",
        "identifierref": "RES_PRESENTACION",
        "title": "Presentacion del Curso"
      },
      {
        "identifier": "ITEM_UNIDAD_01",
        "identifierref": "RES_UNIDAD_01",
        "title": "Fundamentos de diversidad e inclusi\u00f3n"
      },
      {
        "identifier": "ITEM_UNIDAD_02",
        "identifierref": "RES_UNIDAD_02",
        "title": "Sesgos, estereotipos y microagresiones"
      },
      {
        "identifier": "ITEM_UNIDAD_03",
        "identifierref": "RES_UNIDAD_03",
        "title": "Pr\u00e1cticas de inclusi\u00f3n en el d\u00eda a d\u00eda"
      },
      {
        "identifier": "ITEM_UNIDAD_04",
        "identifierref": "RES_UNIDAD_04",
        "title": "Cierre del curso"
      },
      {
        "identifier": "ITEM_UNIDAD_05",
        "identifierref": "RES_UNIDAD_05",
        "title": "Material de apoyo"
      },
      {
        "identifier": "ITEM_RECURSOS",
        "identifierref": "RES_RECURSOS",
        "title": "Recursos"
      }
    ]
  },
  "resources": [
    {
      "identifier": "RES_PRESENTACION",
      "scormType": "sco"
    },
    {
      "identifier": "RES_UNIDAD_01",
      "scormType": "sco"
    },
    {
      "identifier": "RES_UNIDAD_02",
      "scormType": "sco"
    },
    {
      "identifier": "RES_UNIDAD_03",
      "scormType": "sco"
    },
    {
      "identifier": "RES_UNIDAD_04",
      "scormType": "sco"
    },
    {
      "identifier": "RES_UNIDAD_05",
      "scormType": "sco"
    },
    {
      "identifier": "RES_RECURSOS",
      "scormType": "sco"
    },
    {
      "identifier": "RES_SHARED",
      "scormType": "asset"
    }
  ]
} as const;

/**
 * `lmsEnrollments.scoStates` real de las cuatro matriculas que tenian estado.
 * Esta es la poblacion CON atribucion SCO <-> payload (H-7).
 *
 * Observaciones que los tests fijan:
 *  - `nati` y `marcos`: `done` vacio en el 100% de sus SCOs, `actual` hasta
 *    5 y 4. Si la senal dependiera de `done`, las dos darian cero.
 *  - `nati.ITEM_PRESENTACION` y `tomas.ITEM_PRESENTACION` NO tienen
 *    `lessonStatus`. La derivacion no puede asumir que la clave existe.
 *  - `zephyracs` tiene `ITEM_RECURSOS` (el ultimo item del curso) con dos
 *    unidades intermedias sin tocar: el borde "no contiguo".
 */
export const REAL_SCO_STATES = {
  "nati": {
    "ITEM_PRESENTACION": {
      "suspendData": "{\"done\":[],\"actual\":2}"
    },
    "ITEM_UNIDAD_01": {
      "lessonStatus": "incomplete",
      "suspendData": "{\"done\":[],\"actual\":5}"
    },
    "ITEM_UNIDAD_02": {
      "lessonStatus": "incomplete",
      "suspendData": "{\"done\":[],\"actual\":2}"
    },
    "ITEM_UNIDAD_03": {
      "lessonStatus": "incomplete",
      "suspendData": "{\"done\":[],\"actual\":0}"
    },
    "ITEM_UNIDAD_04": {
      "lessonStatus": "incomplete",
      "suspendData": "{\"done\":[],\"actual\":2}"
    }
  },
  "zephyracs": {
    "ITEM_RECURSOS": {
      "suspendData": "{\"done\":[3],\"actual\":2}"
    },
    "ITEM_UNIDAD_01": {
      "lessonStatus": "incomplete",
      "suspendData": "{\"done\":[3],\"actual\":2}"
    },
    "ITEM_UNIDAD_03": {
      "lessonStatus": "incomplete",
      "suspendData": "{\"done\":[],\"actual\":0}"
    }
  },
  "marcos": {
    "ITEM_PRESENTACION": {
      "lessonStatus": "incomplete",
      "suspendData": "{\"done\":[],\"actual\":4}"
    },
    "ITEM_UNIDAD_01": {
      "lessonStatus": "incomplete",
      "suspendData": "{\"done\":[],\"actual\":3}"
    },
    "ITEM_UNIDAD_02": {
      "lessonStatus": "incomplete",
      "suspendData": "{\"done\":[],\"actual\":4}"
    },
    "ITEM_UNIDAD_03": {
      "lessonStatus": "incomplete",
      "suspendData": "{\"done\":[],\"actual\":3}"
    },
    "ITEM_UNIDAD_04": {
      "lessonStatus": "incomplete",
      "suspendData": "{\"done\":[],\"actual\":4}"
    }
  },
  "tomas": {
    "ITEM_PRESENTACION": {
      "suspendData": "{\"done\":[0,1,2,3,4,5,6,7],\"actual\":8}"
    },
    "ITEM_UNIDAD_01": {
      "lessonStatus": "incomplete",
      "scoreRaw": 1.0,
      "suspendData": "{\"done\":[0,1,2,3,4,5,6,7],\"actual\":8}"
    },
    "ITEM_UNIDAD_02": {
      "lessonStatus": "incomplete",
      "suspendData": "{\"done\":[0,1,2],\"actual\":2}"
    },
    "ITEM_UNIDAD_03": {
      "lessonStatus": "incomplete",
      "suspendData": "{\"done\":[0],\"actual\":0}"
    },
    "ITEM_UNIDAD_04": {
      "suspendData": "{\"done\":[0],\"actual\":0}"
    }
  }
} as const;
