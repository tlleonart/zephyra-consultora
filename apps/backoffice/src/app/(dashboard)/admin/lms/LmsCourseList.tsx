"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@zephyra/convex/_generated/api";
import type { Id } from "@zephyra/convex/_generated/dataModel";
import { btnClass } from "@zephyra/ui";
import { academiaPlayerUrl } from "@/features/lms/lib/academia-links";

interface LmsCourseListProps {
  userId: Id<"adminUsers">;
}

interface IssueFeedback {
  // Keyed per-course so simultaneous feedback on two rows doesn't clobber.
  kind: "success" | "error";
  message: string;
}

type StatusFilter = "all" | "published" | "draft" | "archived";

const FILTER_LABELS: Record<StatusFilter, string> = {
  all: "Todos",
  published: "Publicados",
  draft: "Borradores",
  archived: "Archivados",
};

const STATUS_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  published: { bg: "var(--color-success-tint)", fg: "var(--color-success)", label: "Publicado" },
  draft: { bg: "var(--color-warning-tint)", fg: "var(--color-warning)", label: "Borrador" },
  archived: { bg: "var(--color-bg-tertiary)", fg: "var(--color-text-secondary)", label: "Archivado" },
};

function relativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "hace segundos";
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d} días`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `hace ${mo} meses`;
  const y = Math.floor(mo / 12);
  return `hace ${y} años`;
}

function scoCountOf(course: { scoStructure?: unknown }): number {
  const s = course.scoStructure as
    | { resources?: Array<{ scormType?: string | null }> }
    | undefined;
  if (!s?.resources) return 0;
  return s.resources.filter(
    (r) => r.scormType === "sco" || r.scormType === null
  ).length;
}

// Admin LMS course list + ingest entry point (Phase D + E03).
// E03 adds a status filter (default = Publicados), color-coded badges, edit
// links, and shows archived courses so admins can audit superseded versions.
export function LmsCourseList({ userId }: LmsCourseListProps) {
  const courses = useQuery(api.lms.courses.listAll, { userId });
  const setStatus = useMutation(api.lms.courses.setStatus);
  const issueEnrollment = useMutation(api.lms.enrollments.issueEnrollment);

  const [filter, setFilter] = useState<StatusFilter>("published");
  const [openCourseId, setOpenCourseId] = useState<Id<"lmsCourses"> | null>(
    null
  );
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, IssueFeedback>>({});

  const filtered = useMemo(() => {
    if (!courses) return courses;
    if (filter === "all") return courses;
    return courses.filter((c) => c.status === filter);
  }, [courses, filter]);

  const counts = useMemo(() => {
    if (!courses) return { all: 0, published: 0, draft: 0, archived: 0 };
    return {
      all: courses.length,
      published: courses.filter((c) => c.status === "published").length,
      draft: courses.filter((c) => c.status === "draft").length,
      archived: courses.filter((c) => c.status === "archived").length,
    };
  }, [courses]);

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
            background: "var(--color-brand-main)",
            color: "var(--color-bg)",
            borderRadius: 6,
            textDecoration: "none",
          }}
        >
          {/* C-07 (extra, optional). Testers read "Ingestar SCORM" as a
              secondary/import action and reported no way to create a course.
              There isn't a separate creation flow by design (courses come
              from CAMPUS; ingest is what validates them) — this is the one
              button that adds a course, so its label says that first. */}
          + Nuevo curso (ingestar SCORM)
        </Link>
      </div>

      <div
        role="tablist"
        aria-label="Filtro por estado"
        style={{ display: "flex", gap: 6, marginBottom: "1rem", flexWrap: "wrap" }}
      >
        {(Object.keys(FILTER_LABELS) as StatusFilter[]).map((key) => {
          const active = filter === key;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(key)}
              style={{
                padding: "6px 12px",
                borderRadius: 16,
                border: active
                  ? "1px solid var(--color-brand-main)"
                  : "1px solid var(--color-border-strong)",
                background: active ? "var(--color-brand-main)" : "var(--color-bg)",
                color: active ? "var(--color-bg)" : "var(--color-text-secondary)",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {FILTER_LABELS[key]} ({counts[key]})
            </button>
          );
        })}
      </div>

      {courses === undefined && <p>Cargando...</p>}
      {courses && courses.length === 0 && (
        <p style={{ color: "var(--color-text-secondary)" }}>
          Todavía no hay cursos. Ingestá un paquete SCORM para empezar.
        </p>
      )}
      {courses && courses.length > 0 && filtered && filtered.length === 0 && (
        <p style={{ color: "var(--color-text-secondary)" }}>
          No hay cursos en estado &ldquo;{FILTER_LABELS[filter]}&rdquo;.
        </p>
      )}

      {filtered && filtered.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid var(--color-border)" }}>
              <th style={{ padding: 8 }}>Título</th>
              <th style={{ padding: 8 }}>Estado</th>
              <th style={{ padding: 8 }}>campusCourseId</th>
              <th style={{ padding: 8 }}>Creado</th>
              <th style={{ padding: 8 }}>SCOs</th>
              <th style={{ padding: 8 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const courseId = c._id as Id<"lmsCourses">;
              const isOpen = openCourseId === courseId;
              const fb = feedback[courseId];
              const badge = STATUS_COLORS[c.status] ?? {
                bg: "var(--color-bg-tertiary)",
                fg: "var(--color-text)",
                label: c.status,
              };
              return (
                <tr key={c._id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td style={{ padding: 8 }}>
                    <div style={{ fontWeight: 500 }}>{c.title}</div>
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                      <code>{c.slug}</code>
                    </div>
                  </td>
                  <td style={{ padding: 8 }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: badge.bg,
                        color: badge.fg,
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td style={{ padding: 8, fontSize: 12, color: "var(--color-text-secondary)" }}>
                    <code>{c.campusCourseId}</code>
                  </td>
                  <td style={{ padding: 8, fontSize: 12, color: "var(--color-text-muted)" }}>
                    {relativeTime(c.createdAt)}
                  </td>
                  <td style={{ padding: 8, fontSize: 13 }}>{scoCountOf(c)}</td>
                  <td style={{ padding: 8 }}>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      {c.status === "published" && (
                        // CROSS-HOST (V28): the player is served by academia, not
                        // by this host. A plain <a> rather than next/link — the
                        // client router has nothing to prefetch or soft-navigate
                        // across an origin. Same tab, as before.
                        <a
                          href={academiaPlayerUrl(c.slug)}
                          className={btnClass({ variant: "outline", size: "sm" })}
                        >
                          Abrir player
                        </a>
                      )}
                      <Link
                        href={`/admin/lms/courses/${c.slug}/edit`}
                        className={btnClass({ variant: "outline", size: "sm" })}
                      >
                        Editar
                      </Link>
                      {c.status === "draft" && (
                        <button
                          onClick={() =>
                            setStatus({
                              userId,
                              id: courseId,
                              status: "published",
                            })
                          }
                          className={btnClass({ variant: "outline", size: "sm" })}
                        >
                          Publicar
                        </button>
                      )}
                      {c.status === "published" && (
                        <button
                          onClick={() =>
                            setStatus({
                              userId,
                              id: courseId,
                              status: "draft",
                            })
                          }
                          className={btnClass({ variant: "outline", size: "sm" })}
                        >
                          Despublicar
                        </button>
                      )}
                      {c.status !== "archived" && !isOpen && (
                        <button
                          onClick={() => {
                            setOpenCourseId(courseId);
                            setEmail("");
                            setFeedback((f) => {
                              const next = { ...f };
                              delete next[courseId];
                              return next;
                            });
                          }}
                          className={btnClass({ variant: "outline", size: "sm" })}
                        >
                          Dar acceso
                        </button>
                      )}
                      {isOpen && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void handleIssue(courseId);
                          }}
                          style={{
                            display: "flex",
                            gap: 6,
                            alignItems: "center",
                          }}
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
                              border: "1px solid var(--color-text-muted)",
                              borderRadius: 4,
                              minWidth: 220,
                            }}
                          />
                          <button
                            type="submit"
                            disabled={submitting}
                            className={btnClass({ variant: "outline", size: "sm" })}
                          >
                            {submitting ? "Enviando..." : "Otorgar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenCourseId(null);
                              setEmail("");
                            }}
                            className={btnClass({ variant: "outline", size: "sm" })}
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
                          color: fb.kind === "success" ? "var(--color-success)" : "var(--color-error)",
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
