"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

interface LmsCourseListProps {
  userId: Id<"adminUsers">;
}

// Admin LMS course list + ingest entry point (Phase D).
// userId flows from the server-side session in the parent page (mirrors the
// argument-based gating pattern used by adminUsers.list/UserList).
export function LmsCourseList({ userId }: LmsCourseListProps) {
  const courses = useQuery(api.lms.courses.listAll, { userId });
  const setStatus = useMutation(api.lms.courses.setStatus);

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
            {courses.map((c) => (
              <tr key={c._id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: 8 }}>{c.title}</td>
                <td style={{ padding: 8 }}>
                  <code>{c.slug}</code>
                </td>
                <td style={{ padding: 8 }}>{c.status}</td>
                <td style={{ padding: 8, display: "flex", gap: 8 }}>
                  <Link href={`/cursos/${c.slug}/player`}>Abrir player</Link>
                  {c.status !== "published" && (
                    <button
                      onClick={() =>
                        setStatus({
                          userId,
                          id: c._id as Id<"lmsCourses">,
                          status: "published",
                        })
                      }
                      style={{ cursor: "pointer" }}
                    >
                      Publicar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
