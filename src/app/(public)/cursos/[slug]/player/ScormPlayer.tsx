"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Scorm12API } from "scorm-again";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";

/**
 * SCORM 1.2 player + scorm-again bridge (Phase D — AC-D02.3 .. AC-D03.5).
 *
 * Bridge wiring (the centerpiece):
 *  - On mount we instantiate scorm-again's Scorm12API and assign it to
 *    `window.API` (the SCORM 1.2 discovery name) BEFORE the iframe content
 *    loads. The CAMPUS wrapper (`shared/scorm_api_1_2.js`) walks
 *    `window` -> `window.parent` looking for `win.API` and logs
 *    `SCORM 1.2 API encontrada en intento N` when it finds ours (AC-D02.4).
 *  - We register `.on("LMSSetValue" | "LMSCommit" | "LMSFinish")` listeners;
 *    every call is forwarded to the Convex `recordScormEvent` mutation, which
 *    appends to lmsScormEvents AND projects lmsEnrollments (AC-D03.1/2).
 *  - The iframe src points at the SAME-ORIGIN asset proxy
 *    (/api/lms/asset/<slug>/<entryPoint>) so the content is same-origin with
 *    this page — required for `window.parent.API` discovery to work at all
 *    (S0-R3 resolved; see the proxy route handler).
 *  - The progress bar reads the enrollment via a reactive Convex query, so it
 *    updates live as events land (AC-D03.5).
 */

interface Unit {
  title: string;
  href: string;
}

interface ScormPlayerProps {
  userId: Id<"adminUsers">;
  courseId: Id<"lmsCourses">;
  slug: string;
  courseTitle: string;
  entryPoint: string | null;
  units: Unit[];
}

// scorm-again's window.API is not in the global lib types.
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    API?: any;
  }
}

export function ScormPlayer({
  userId,
  courseId,
  slug,
  courseTitle,
  entryPoint,
  units,
}: ScormPlayerProps) {
  const ensureEnrollment = useMutation(api.lms.scormEvents.ensureSpikeEnrollment);
  const recordScormEvent = useMutation(api.lms.scormEvents.recordScormEvent);

  const [enrollmentId, setEnrollmentId] = useState<Id<"lmsEnrollments"> | null>(
    null
  );
  const [apiReady, setApiReady] = useState(false);
  const [currentHref, setCurrentHref] = useState<string | null>(entryPoint);
  const enrollmentRef = useRef<Id<"lmsEnrollments"> | null>(null);

  // Reactive: getEnrollment is keyed by (spike-learner, courseId) server-side
  // so the live progress bar updates as soon as recordScormEvent commits.
  const enrollment = useQuery(api.lms.scormEvents.getEnrollment, {
    userId,
    courseId,
  });

  // Ensure the placeholder spike enrollment exists (AC-D02.1).
  useEffect(() => {
    let cancelled = false;
    ensureEnrollment({ userId, courseId }).then((id) => {
      if (cancelled) return;
      enrollmentRef.current = id;
      setEnrollmentId(id);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, courseId, ensureEnrollment]);

  // Install the SCORM 1.2 API on window BEFORE the iframe loads (AC-D02.3).
  useEffect(() => {
    if (!enrollmentId) return;

    const api = new Scorm12API({
      autocommit: false,
    });

    let commitCounter = 0;
    const currentCommitId = () => `commit-${commitCounter}`;

    const forward = (element: string, value: string, commitId?: string) => {
      const eid = enrollmentRef.current;
      if (!eid) return;
      // Fire-and-forget; Convex is reactive so the UI updates on its own.
      void recordScormEvent({
        userId,
        enrollmentId: eid,
        element,
        value,
        commitId,
      });
    };

    // AC-D03.1: every SetValue is captured (element + value).
    api.on("LMSSetValue", (element: string, value: string) => {
      forward(element, String(value), currentCommitId());
    });
    // AC-D03.1: Commit boundary — record a marker and advance the commit group.
    api.on("LMSCommit", () => {
      forward("__commit__", currentCommitId());
      commitCounter += 1;
    });
    // AC-D03.1: Finish — record terminal marker.
    api.on("LMSFinish", () => {
      forward("__finish__", new Date().toISOString());
    });

    window.API = api;
    setApiReady(true);

    return () => {
      try {
        api.clear("LMSSetValue");
        api.clear("LMSCommit");
        api.clear("LMSFinish");
      } catch {
        /* noop */
      }
      if (window.API === api) {
        delete window.API;
      }
    };
  }, [enrollmentId, recordScormEvent, userId]);

  const iframeSrc =
    apiReady && currentHref
      ? `/api/lms/asset/${encodeURIComponent(slug)}/${currentHref
          .split("/")
          .map(encodeURIComponent)
          .join("/")}`
      : undefined;

  const progress = enrollment?.progressPercent ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header
        style={{
          padding: "12px 20px",
          borderBottom: "1px solid #e5e5e5",
          background: "#fafafa",
        }}
      >
        <h1 style={{ fontSize: 18, margin: 0 }}>{courseTitle}</h1>
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              flex: 1,
              maxWidth: 360,
              height: 8,
              background: "#eee",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: "#2d7",
                transition: "width 0.3s",
              }}
            />
          </div>
          <small style={{ color: "#555" }}>
            Progreso: {progress}% · Estado:{" "}
            {enrollment?.lessonStatus ?? "—"} · Puntaje:{" "}
            {enrollment?.scoreRaw ?? "—"}
          </small>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Unit navigation (each SCO item) */}
        <nav
          style={{
            width: 240,
            borderRight: "1px solid #e5e5e5",
            overflow: "auto",
            padding: 12,
            background: "#fff",
          }}
        >
          <strong style={{ fontSize: 12, color: "#888" }}>UNIDADES</strong>
          <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}>
            {units.map((u) => (
              <li key={u.href} style={{ marginBottom: 4 }}>
                <button
                  onClick={() => setCurrentHref(u.href)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    background: currentHref === u.href ? "#eefbf2" : "transparent",
                    fontWeight: currentHref === u.href ? 600 : 400,
                  }}
                >
                  {u.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* The SCO iframe (AC-D02.2). Same-origin via the asset proxy so the
            provider wrapper can reach window.parent.API. */}
        <main style={{ flex: 1, minWidth: 0 }}>
          {iframeSrc ? (
            <iframe
              key={iframeSrc}
              src={iframeSrc}
              title={courseTitle}
              sandbox="allow-scripts allow-same-origin"
              style={{ width: "100%", height: "100%", border: "none" }}
            />
          ) : (
            <div style={{ padding: 40, color: "#888" }}>
              Inicializando SCORM API…
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
