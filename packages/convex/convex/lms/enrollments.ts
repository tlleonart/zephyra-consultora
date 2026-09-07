/**
 * LMS — Enrollment functions (Sprint 1 D01).
 *
 * Replaces Sprint-0's `ensureSpikeEnrollment` placeholder. Real flow:
 *   - issueEnrollment (admin-gated): admin enters a learner's email, we look
 *     up the lmsCustomers row, and we insert an active enrollment for the
 *     (learner, course) pair. Idempotent on duplicate-active to absorb a
 *     double-click without inserting a second row.
 *   - getMyEnrollment (learner-self): server-side query the player page calls
 *     to gate access. NO upstream requireAuth: the caller is a Next.js server
 *     component that has already validated the `session-learner` cookie via
 *     getLearnerSession() and is passing the resulting learnerId. If a hostile
 *     learner forges another's learnerId at the boundary, the worst exposure
 *     is "does this OTHER learner have an active enrollment for this course"
 *     — no PII (no email, no name; the row only contains progress numbers
 *     plus the same learnerId the attacker already supplied). The
 *     security-equivalent admin pattern is `lms/courses.ts:getBySlug` —
 *     also unauthenticated, also relies on the surface-layer gate.
 *   - listMyEnrollments: same trust contract as getMyEnrollment. Powers a
 *     future `/cursos/mis-cursos` dashboard; shipped now so the surface is
 *     symmetric and a follow-up task doesn't have to re-open this file.
 */

import { internalMutation, mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { Doc } from "../_generated/dataModel";
import { AuthError, requireAuth, requireRole } from "../model/auth";
import { deriveCoursePosition } from "./coursePosition";

// Same normalizer as lms/auth.ts. Inlined (not imported) because the auth
// module is large and we only need the trim+lowercase shape; keeping this
// file self-contained avoids pulling magic-link symbols into the bundle.
const normalizeEmail = (raw: string): string => raw.trim().toLowerCase();

// ============================================================================
// issueEnrollment — admin gives a learner access to a course
// ============================================================================
export const issueEnrollment = mutation({
  args: {
    userId: v.id("adminUsers"),
    courseId: v.id("lmsCourses"),
    learnerEmail: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.userId);
    await requireRole(ctx, args.userId, "admin");

    const course = await ctx.db.get(args.courseId);
    if (!course || course.deletedAt) {
      throw new AuthError("curso no encontrado");
    }

    const email = normalizeEmail(args.learnerEmail);

    const customer = await ctx.db
      .query("lmsCustomers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    // Issuing access requires the learner to already be a known customer.
    // Activation (sign-up + magic link consume) is the only path that creates
    // an lmsCustomers row — admin cannot pre-create on the learner's behalf
    // (PDD §7.5 + the H-2 mitigation: admins are never authors of learner
    // identity-bearing rows).
    if (!customer || customer.deletedAt) {
      throw new AuthError(
        "learner no encontrado — debe activar su cuenta primero"
      );
    }

    // Idempotency: a double-click on "Dar acceso" must not insert a duplicate
    // active enrollment. The index includes status so the same (learner,
    // course) pair can hold an expired row + a fresh active row over time;
    // we only collapse on active.
    const existing = await ctx.db
      .query("lmsEnrollments")
      .withIndex("by_learner_course_status", (q) =>
        q
          .eq("learnerId", customer._id)
          .eq("courseId", args.courseId)
          .eq("status", "active")
      )
      .first();

    if (existing) {
      return {
        enrollmentId: existing._id,
        customer: { _id: customer._id, email: customer.email },
        alreadyEnrolled: true,
      };
    }

    const now = Date.now();
    // D02: completedScoCount + scoStates start empty. totalScos is NOT
    // denormalized — it lives on the course row (PDD §6.3 archive-on-duplicate
    // means re-ingestion can change it; courseId is the source of truth).
    const enrollmentId = await ctx.db.insert("lmsEnrollments", {
      learnerId: customer._id,
      courseId: args.courseId,
      status: "active",
      progressPercent: 0,
      completedScoCount: 0,
      scoStates: {},
      updatedAt: now,
    });

    return {
      enrollmentId,
      customer: { _id: customer._id, email: customer.email },
      alreadyEnrolled: false,
    };
  },
});

// ============================================================================
// grantEnrollmentForOrder — entitlement on a PAID order (Sprint 2 P0.5)
// ============================================================================
//
// internalMutation ONLY — there is NO client-facing path to mint an
// entitlement (SDD §7, signed control #6: no client-minted entitlements).
// Called exclusively from the webhook's processVerifiedPayment transaction
// (convex/lms/payment/internal.ts) on the approved branch.
//
// Reuses the issueEnrollment lookup-before-insert idempotency pattern: a
// duplicate webhook (or an order whose enrollment already exists) returns the
// existing active row instead of inserting a second one. B2C only — no seatId
// / claimRequestId (those land with the Sprint 3 org-managed seat flow).
export const grantEnrollmentForOrder = internalMutation({
  args: { orderId: v.id("lmsOrders") },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order || order.deletedAt) {
      throw new Error(
        `grantEnrollmentForOrder: order not found: ${args.orderId}`
      );
    }

    // Idempotency: collapse on the active (learner, course) row so a duplicate
    // webhook delivery (or a re-paid order) never piles up enrollments.
    const existing = await ctx.db
      .query("lmsEnrollments")
      .withIndex("by_learner_course_status", (q) =>
        q
          .eq("learnerId", order.customerId)
          .eq("courseId", order.courseId)
          .eq("status", "active")
      )
      .first();

    if (existing) {
      return { enrollmentId: existing._id, alreadyEnrolled: true };
    }

    const now = Date.now();
    const enrollmentId = await ctx.db.insert("lmsEnrollments", {
      learnerId: order.customerId,
      courseId: order.courseId,
      status: "active",
      progressPercent: 0,
      completedScoCount: 0,
      scoStates: {},
      startedAt: now,
      updatedAt: now,
    });

    return { enrollmentId, alreadyEnrolled: false };
  },
});

// ============================================================================
// getMyEnrollment — learner reads own enrollment for a course
// ============================================================================
//
// Trust contract: caller (server-side via getLearnerSession()) passes
// learnerId from a validated cookie. No upstream gate; see header comment for
// the threat-model reasoning.
export const getMyEnrollment = query({
  args: {
    learnerId: v.id("lmsCustomers"),
    courseId: v.id("lmsCourses"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("lmsEnrollments")
      .withIndex("by_learner_course_status", (q) =>
        q
          .eq("learnerId", args.learnerId)
          .eq("courseId", args.courseId)
          .eq("status", "active")
      )
      .first();
  },
});

// ============================================================================
// listMyEnrollments — learner reads own enrollments across courses
// ============================================================================
//
// Same trust contract as getMyEnrollment. Returns active + completed; expired
// is excluded so the learner dashboard doesn't surface stale rows alongside
// live ones.
export const listMyEnrollments = query({
  args: {
    learnerId: v.id("lmsCustomers"),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("lmsEnrollments")
      .withIndex("by_learner", (q) => q.eq("learnerId", args.learnerId))
      .collect();
    return rows.filter((r) => r.status !== "expired");
  },
});

// ============================================================================
// listMyCoursesWithProgress — lo que /cursos/mis-cursos necesita, de una
// ============================================================================
//
// POR QUÉ EXISTE, SI YA ESTÁ listMyEnrollments (hallazgo H-4): porque
// listMyEnrollments devuelve las filas CRUDAS de lmsEnrollments y nada más.
// No trae título, ni slug, ni portada, ni scoStructure — o sea, ninguno de
// los cuatro datos que la pantalla de la alumna pinta. El mapa de reuso de la
// spec daba por hecho que alcanzaba con consumirla; no alcanza. Esta query
// joinea el curso y deriva la posición, así la pantalla hace UN viaje.
//
// listMyEnrollments SE QUEDA COMO ESTÁ: la consumen el proxy de assets y
// claim-seat.ts, y esta query no la reemplaza — le agrega un vecino.
//
// MISMO CONTRATO DE CONFIANZA que getMyEnrollment y listMyEnrollments: NO hay
// requireAuth acá arriba. El llamador es un server component de Next.js que
// ya validó la cookie `session-learner` con getLearnerSession() y baja el
// learnerId resultante. Si alguien forjara el learnerId de otra en el borde,
// la exposición máxima es "qué cursos tiene esa otra learner" — mismos datos
// que ya expone listMyEnrollments, más título y portada de cursos que son
// PÚBLICOS en el catálogo. Ningún PII nuevo: ni mail, ni nombre, ni
// identidad. Se excluye `expired`, igual que listMyEnrollments, para que el
// tablero no mezcle matrículas muertas con vivas.
//
// LA SEÑAL DE AVANCE ES POSICIÓN, NO PORCENTAJE. Ver lms/coursePosition.ts
// para la regla y el porqué. `progressPercent` NO se expone acá a propósito:
// por decisión D-1 sigue valiendo 0 en la base para todo el mundo, así que
// mandarlo a la pantalla sería mandarle una mentira.
export const listMyCoursesWithProgress = query({
  args: {
    learnerId: v.id("lmsCustomers"),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("lmsEnrollments")
      .withIndex("by_learner", (q) => q.eq("learnerId", args.learnerId))
      .collect();

    const live = rows
      .filter((r) => r.status !== "expired")
      // Más recién tocada primero: "seguir donde iba" es el gesto de la
      // pantalla. updatedAt se escribe en el insert y en cada evento SCORM,
      // así que una matrícula nunca abierta cae al fondo sola.
      .sort((a, b) => b.updatedAt - a.updatedAt);

    // Caché por curso: varias matrículas pueden apuntar al mismo curso (una
    // individual y una por asiento, p.ej.). Un solo point-read por curso.
    const courseCache = new Map<string, Doc<"lmsCourses"> | null>();
    const out = [];

    for (const enrollment of live) {
      const courseKey = enrollment.courseId as string;
      if (!courseCache.has(courseKey)) {
        courseCache.set(courseKey, await ctx.db.get(enrollment.courseId));
      }
      const course = courseCache.get(courseKey) ?? null;
      // Sin fila de curso no hay tarjeta que pintar (ni título ni destino).
      // No debería pasar —el archivado por re-ingesta CONSERVA la fila, y el
      // borrado es blando— pero la pantalla no se cae por un dato faltante.
      if (!course) continue;

      out.push({
        enrollmentId: enrollment._id,
        status: enrollment.status,
        courseId: course._id,
        courseSlug: course.slug,
        courseTitle: course.title,
        // Se devuelven los dos: la URL firmada para pintar ya, y el storageId
        // por si el consumidor prefiere resolverla él (es lo que hace hoy
        // apps/academia/src/lib/course-catalog.ts para el catálogo público).
        coverStorageId: course.coverStorageId ?? null,
        coverUrl: course.coverStorageId
          ? await ctx.storage.getUrl(course.coverStorageId)
          : null,
        position: deriveCoursePosition(
          enrollment.scoStates,
          course.scoStructure
        ),
      });
    }

    return out;
  },
});
