"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

interface LmsCourseListProps {
  userId: Id<"adminUsers">;
}

interface IssueFeedback {
  // Keyed per-course so simultaneous feedback on two rows doesn't clobber.
  kind: "success" | "error";
  message: string;
}

// Admin LMS course list + ingest entry point (Phase D).
// userId flows from the server-side session in the parent page (mirrors the
// argument-based gating pattern used by adminUsers.list/UserList).
//
// D01: per-course inline "Dar acceso" interaction. We open the email input
// inline on the row (not a modal) to keep the surface trivial — issuing
// access is a one-field action and a row-level disclosure carries enough UX
// context (you can see which course you're issuing access to).
export function LmsCourseList({ userId }: LmsCourseListProps) {
  const courses = useQuery(api.lms.courses.listAll, { userId });
  const setStatus = useMutation(api.lms.courses.setStatus);
  const issueEnrollment = useMutation(api.lms.enrollments.issueEnrollment);

  const [openCourseId, setOpenCourseId] = useState<Id<"lmsCourses"> | null>(
    null
  );
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, IssueFeedback>>({});

  const handleIssue = async (courseId: Id<"lmsCourses">) => {
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const result = await issueEnrollment({
        userId,
        courseId,
        learnerEmail: email,
      });
      setFeedback((f) => ({
        ...f,
        [courseId]: {
          kind: "success",
          message: result.alreadyEnrolled
            ? `Ya tenía acceso: ${result.customer.email}`
            : `Acceso otorgado a ${result.customer.email}`,
        },
      }));
      setEmail("");
      setOpenCourseId(null);
    } catch (err) {
      setFeedback((f) => ({
        ...f,
        [courseId]: {
          kind: "error",
          message: err instanceof Error ? err.message : "Error desconocido",
        },
      }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section style={{ padding: "2rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <h1>LMS — Cursos</h1>
        <Link
          href="/admin/lms/courses/new"
          style={{
            padding: "10px 16px",
            background: "#2d7",
            color: "#fff",
            borderRadius: 6,
            textDecoration: "none",
          }}
        >
          + Ingestar SCORM
        </Link>
      </div>

      {courses === undefined && <p>Cargando...</p>}
      {courses && courses.length === 0 && (
        <p style={{ color: "#666" }}>
          Todavía no hay cursos. Ingestá un paquete SCORM para empezar.
        </p>
      )}

      {courses && courses.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #eee" }}>
              <th style={{ padding: 8 }}>Título</th>
              <th style={{ padding: 8 }}>Slug</th>
              <th style={{ padding: 8 }}>Estado</th>
              <th style={{ padding: 8 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => {
              const courseId = c._id as Id<"lmsCourses">;
              const isOpen = openCourseId === courseId;
              const fb = feedback[courseId];
              return (
                <tr key={c._id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: 8 }}>{c.title}</td>
                  <td style={{ padding: 8 }}>
                    <code>{c.slug}</code>
                  </td>
                  <td style={{ padding: 8 }}>{c.status}</td>
                  <td style={{ padding: 8 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <Link href={`/cursos/${c.slug}/player`}>Abrir player</Link>
                      {c.status !== "published" && (
                        <button
                          onClick={() =>
                            setStatus({
                              userId,
                              id: courseId,
                              status: "published",
                            })
                          }
                          style={{ cursor: "pointer" }}
                        >
                          Publicar
                        </button>
                      )}
                      {!isOpen && (
                        <button
                          onClick={() => {
                            setOpenCourseId(courseId);
                            setEmail("");
                            // Clear stale feedback for this course on reopen.
                            setFeedback((f) => {
                              const next = { ...f };
                              delete next[courseId];
                              return next;
                            });
                          }}
                          style={{ cursor: "pointer" }}
                        >
                          Dar acceso a un alumno
                        </button>
                      )}
                      {isOpen && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void handleIssue(courseId);
                          }}
                          style={{ display: "flex", gap: 6, alignItems: "center" }}
                        >
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="email del alumno"
                            autoFocus
                            required
                            style={{
                              padding: "4px 8px",
                              border: "1px solid #ccc",
                              borderRadius: 4,
                              minWidth: 220,
                            }}
                          />
                          <button
                            type="submit"
                            disabled={submitting}
                            style={{ cursor: submitting ? "default" : "pointer" }}
                          >
                            {submitting ? "Enviando..." : "Otorgar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenCourseId(null);
                              setEmail("");
                            }}
                            style={{ cursor: "pointer" }}
                          >
                            Cancelar
                          </button>
                        </form>
                      )}
                    </div>
                    {fb && (
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 13,
                          color: fb.kind === "success" ? "#0a7" : "#c33",
                        }}
                      >
                        {fb.message}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
