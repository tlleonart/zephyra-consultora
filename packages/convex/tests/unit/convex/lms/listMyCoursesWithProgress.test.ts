/**
 * Tests de convex/lms/enrollments.ts → listMyCoursesWithProgress (T-be-002).
 *
 * La query nace del hallazgo H-4: `listMyEnrollments` devuelve filas crudas de
 * `lmsEnrollments` y NO trae título, slug, portada ni scoStructure, o sea
 * ninguno de los cuatro datos que /cursos/mis-cursos pinta. Estos tests fijan
 * el contrato que consume la pantalla, y fijan que `listMyEnrollments` sigue
 * intacta al lado (la consumen el proxy de assets y claim-seat.ts).
 */
import { describe, it, expect } from "vitest";
import {
  listMyCoursesWithProgress,
  listMyEnrollments,
} from "../../../../convex/lms/enrollments";
import { REAL_SCO_STATES, REAL_SCO_STRUCTURE } from "../../../fixtures/scormRealSamples2026-09-04";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const listHandler = (listMyCoursesWithProgress as any)._handler as (
  ctx: unknown,
  args: unknown
) => Promise<
  Array<{
    enrollmentId: string;
    status: string;
    courseId: string;
    courseSlug: string;
    courseTitle: string;
    coverStorageId: string | null;
    coverUrl: string | null;
    position: {
      moduleIndex: number;
      moduleTotal: number;
      moduleTitle: string | null;
      state: string;
      moduleTouched: boolean;
    };
  }>
>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const listEnrollmentsHandler = (listMyEnrollments as any)._handler as (
  ctx: unknown,
  args: unknown
) => Promise<Array<Record<string, unknown>>>;

const LEARNER = "customer-1";

interface Row {
  _id: string;
  [key: string]: unknown;
}

/**
 * Store mínimo: `by_learner` sobre lmsEnrollments + point-reads por _id +
 * ctx.storage.getUrl. Se cuentan las lecturas para poder fijar que no hay N+1.
 */
const makeCtx = (enrollments: Row[], courses: Row[]) => {
  const reads: string[] = [];
  const storageCalls: string[] = [];
  const ctx = {
    db: {
      query: (table: string) => {
        if (table !== "lmsEnrollments") throw new Error("tabla inesperada");
        return {
          withIndex: (name: string, fn: (q: unknown) => unknown) => {
            expect(name).toBe("by_learner");
            let learnerId = "";
            fn({
              eq: (field: string, value: string) => {
                expect(field).toBe("learnerId");
                learnerId = value;
                return {};
              },
            });
            return {
              collect: async () =>
                enrollments.filter((e) => e.learnerId === learnerId),
            };
          },
        };
      },
      get: async (id: string) => {
        reads.push(id);
        return courses.find((c) => c._id === id) ?? null;
      },
    },
    storage: {
      getUrl: async (id: string) => {
        storageCalls.push(id);
        return `https://storage.test/${id}`;
      },
    },
  };
  return { ctx, reads, storageCalls };
};

const CURSO: Row = {
  _id: "course-1",
  slug: "diversidad-equidad-e-inclusion",
  title: "Diversidad, equidad e inclusión en el trabajo",
  coverStorageId: "storage-cover-1",
  scoStructure: REAL_SCO_STRUCTURE,
};

const matricula = (over: Record<string, unknown> = {}): Row => ({
  _id: "enr-1",
  learnerId: LEARNER,
  courseId: "course-1",
  status: "active",
  progressPercent: 0,
  completedScoCount: 0,
  scoStates: {},
  updatedAt: 100,
  ...over,
});

describe("listMyCoursesWithProgress — el contrato de /cursos/mis-cursos", () => {
  it("joinea el curso: slug, título y portada, que la fila cruda no trae", async () => {
    const { ctx } = makeCtx([matricula()], [CURSO]);
    const [row] = await listHandler(ctx, { learnerId: LEARNER });

    expect(row.enrollmentId).toBe("enr-1");
    expect(row.status).toBe("active");
    expect(row.courseId).toBe("course-1");
    expect(row.courseSlug).toBe("diversidad-equidad-e-inclusion");
    expect(row.courseTitle).toBe(
      "Diversidad, equidad e inclusión en el trabajo"
    );
    expect(row.coverStorageId).toBe("storage-cover-1");
    expect(row.coverUrl).toBe("https://storage.test/storage-cover-1");

    // Y H-4 verificado del otro lado: la query vieja NO trae nada de esto.
    const [cruda] = await listEnrollmentsHandler(ctx, { learnerId: LEARNER });
    expect(cruda.courseTitle).toBeUndefined();
    expect(cruda.courseSlug).toBeUndefined();
    expect(cruda.coverUrl).toBeUndefined();
  });

  it("trae la POSICIÓN derivada: el caso real de Nati da Módulo 5 de 7", async () => {
    const { ctx } = makeCtx(
      [matricula({ scoStates: REAL_SCO_STATES.nati })],
      [CURSO]
    );
    const [row] = await listHandler(ctx, { learnerId: LEARNER });
    expect(row.position).toEqual({
      moduleIndex: 5,
      moduleTotal: 7,
      moduleTitle: "Cierre del curso",
      state: "in-progress",
      moduleTouched: true,
    });
  });

  it("NO expone progressPercent — sigue en 0 en la base y sería una mentira", async () => {
    const { ctx } = makeCtx(
      [matricula({ scoStates: REAL_SCO_STATES.nati, progressPercent: 0 })],
      [CURSO]
    );
    const [row] = await listHandler(ctx, { learnerId: LEARNER });
    expect(row).not.toHaveProperty("progressPercent");
    expect(row).not.toHaveProperty("completedScoCount");
    // Contrato congelado para Johan: si alguien agrega un campo, este test cae.
    expect(Object.keys(row).sort()).toEqual([
      "courseId",
      "courseSlug",
      "courseTitle",
      "coverStorageId",
      "coverUrl",
      "enrollmentId",
      "position",
      "status",
    ]);
  });

  it("excluye `expired`, igual que listMyEnrollments", async () => {
    const { ctx } = makeCtx(
      [
        matricula({ _id: "enr-activa", status: "active" }),
        matricula({ _id: "enr-vencida", status: "expired" }),
        matricula({ _id: "enr-terminada", status: "completed" }),
      ],
      [CURSO]
    );
    const rows = await listHandler(ctx, { learnerId: LEARNER });
    expect(rows.map((r) => r.enrollmentId).sort()).toEqual([
      "enr-activa",
      "enr-terminada",
    ]);
  });

  it("no devuelve matrículas de otra learner", async () => {
    const { ctx } = makeCtx(
      [
        matricula({ _id: "mia" }),
        matricula({ _id: "ajena", learnerId: "customer-2" }),
      ],
      [CURSO]
    );
    const rows = await listHandler(ctx, { learnerId: LEARNER });
    expect(rows).toHaveLength(1);
    expect(rows[0].enrollmentId).toBe("mia");
  });

  it("ordena por updatedAt descendente — 'seguir donde iba' primero", async () => {
    const { ctx } = makeCtx(
      [
        matricula({ _id: "vieja", updatedAt: 10 }),
        matricula({ _id: "reciente", updatedAt: 900 }),
        matricula({ _id: "media", updatedAt: 500 }),
      ],
      [CURSO]
    );
    const rows = await listHandler(ctx, { learnerId: LEARNER });
    expect(rows.map((r) => r.enrollmentId)).toEqual([
      "reciente",
      "media",
      "vieja",
    ]);
  });

  it("sin portada: coverStorageId y coverUrl en null, sin llamar a storage", async () => {
    const { ctx, storageCalls } = makeCtx(
      [matricula()],
      [{ ...CURSO, coverStorageId: undefined }]
    );
    const [row] = await listHandler(ctx, { learnerId: LEARNER });
    expect(row.coverStorageId).toBeNull();
    expect(row.coverUrl).toBeNull();
    expect(storageCalls).toEqual([]);
  });

  it("dos matrículas del mismo curso: UN solo point-read (sin N+1)", async () => {
    const { ctx, reads } = makeCtx(
      [
        matricula({ _id: "enr-1", updatedAt: 2 }),
        matricula({ _id: "enr-2", updatedAt: 1 }),
      ],
      [CURSO]
    );
    const rows = await listHandler(ctx, { learnerId: LEARNER });
    expect(rows).toHaveLength(2);
    expect(reads).toEqual(["course-1"]);
  });

  it("curso inexistente: se saltea la fila en vez de romper la pantalla", async () => {
    const { ctx } = makeCtx(
      [
        matricula({ _id: "buena" }),
        matricula({ _id: "huerfana", courseId: "course-fantasma" }),
      ],
      [CURSO]
    );
    const rows = await listHandler(ctx, { learnerId: LEARNER });
    expect(rows.map((r) => r.enrollmentId)).toEqual(["buena"]);
  });

  it("sin matrículas: array vacío (estado vacío de la pantalla)", async () => {
    const { ctx } = makeCtx([], [CURSO]);
    expect(await listHandler(ctx, { learnerId: LEARNER })).toEqual([]);
  });

  it("curso sin scoStructure: posición degradada, sin tirar", async () => {
    const { ctx } = makeCtx(
      [matricula()],
      [{ ...CURSO, scoStructure: undefined }]
    );
    const [row] = await listHandler(ctx, { learnerId: LEARNER });
    expect(row.position.moduleTotal).toBe(0);
    expect(row.position.state).toBe("not-started");
  });

  it("scoStates con basura: la matrícula se devuelve igual", async () => {
    // AC 22 del lado del consumidor: un payload podrido no puede sacar el
    // curso de la lista de la alumna.
    const { ctx } = makeCtx(
      [
        matricula({
          scoStates: {
            ITEM_UNIDAD_01: { suspendData: "{roto" },
            ITEM_UNIDAD_02: { suspendData: "" },
          },
        }),
      ],
      [CURSO]
    );
    const [row] = await listHandler(ctx, { learnerId: LEARNER });
    expect(row.courseTitle).toBe(
      "Diversidad, equidad e inclusión en el trabajo"
    );
    expect(row.position.moduleIndex).toBe(3);
    expect(row.position.moduleTouched).toBe(false);
  });
});
