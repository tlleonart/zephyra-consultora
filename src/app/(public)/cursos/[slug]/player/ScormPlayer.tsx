"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { Scorm12API } from "scorm-again";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import styles from "./ScormPlayer.module.css";

/**
 * SCORM 1.2 player + scorm-again bridge (D02 — multi-SCO + cross-session resume).
 *
 * D02 deltas over D01:
 *  - Per-SCO state: every recordScormEvent call carries scoId; the player
 *    swaps the active SCO via a sidebar nav when course has >1 SCO.
 *  - Cross-session resume: before the iframe boots, we hydrate
 *    api.cmi.suspend_data from enrollment.scoStates[scoId].suspendData so the
 *    SCO's own wrapper reads "where it was" via the SCORM 1.2 GetValue call,
 *    not from zero. WHY assign BEFORE the iframe <script> runs LMSInitialize:
 *    the wrapper grabs cmi.suspend_data once during init and won't re-read it
 *    later; injecting after init is a no-op.
 *  - We rebuild the Scorm12API instance per SCO selection so cmi state is
 *    isolated (a SCO's lesson_status doesn't leak across siblings).
 *
 * Bridge wiring (the centerpiece, unchanged from D01):
 *  - We assign the Scorm12API instance to window.API (the SCORM 1.2 discovery
 *    name) BEFORE the iframe loads. The CAMPUS wrapper walks
 *    window -> window.parent looking for win.API.
 *  - LMSSetValue / LMSCommit / LMSFinish each forward to recordScormEvent,
 *    keyed on the currently-selected scoId.
 *  - The iframe src points at the SAME-ORIGIN asset proxy so the content
 *    is same-origin with this page (required for window.parent.API discovery).
 *  - useQuery on getEnrollment is reactive — progress bar + per-SCO
 *    checkmarks update live as events land.
 */

interface Unit {
  scoId: string;
  title: string;
  href: string;
}

interface ScoState {
  lessonStatus?: string;
  scoreRaw?: number;
  suspendData?: string;
  completedAt?: number;
}

interface ScormPlayerProps {
  learnerId: Id<"lmsCustomers">;
  courseId: Id<"lmsCourses">;
  enrollmentId: Id<"lmsEnrollments">;
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

const TERMINAL_COMPLETE = new Set(["completed", "passed"]);

export function ScormPlayer({
  learnerId,
  courseId,
  enrollmentId,
  slug,
  courseTitle,
  entryPoint,
  units,
}: ScormPlayerProps) {
  const recordScormEvent = useMutation(api.lms.scormEvents.recordScormEvent);

  // The "current" unit (selected SCO). Default to the unit whose href matches
  // entryPoint, falling back to the first unit. WHY derive defensively: a
  // course may carry an entryPoint that points outside the items list (rare,
  // but the manifest parser allows it via the "first SCO resource" fallback).
  const initialIdx = useMemo(() => {
    if (!units.length) return 0;
    if (entryPoint) {
      const i = units.findIndex((u) => u.href === entryPoint);
      if (i >= 0) return i;
    }
    return 0;
  }, [units, entryPoint]);

  const [currentIdx, setCurrentIdx] = useState(initialIdx);
  const currentUnit = units[currentIdx] ?? null;

  const enrollmentRef = useRef<Id<"lmsEnrollments">>(enrollmentId);
  enrollmentRef.current = enrollmentId;
  const currentScoIdRef = useRef<string | null>(currentUnit?.scoId ?? null);
  currentScoIdRef.current = currentUnit?.scoId ?? null;

  // Reactive: getEnrollment is keyed by (learnerId, courseId) server-side
  // so the live progress bar updates as soon as recordScormEvent commits.
  const enrollment = useQuery(api.lms.scormEvents.getEnrollment, {
    learnerId,
    courseId,
  });
  const scoStates: Record<string, ScoState> =
    (enrollment?.scoStates as Record<string, ScoState> | undefined) ?? {};

  // apiBootCounter increments whenever we want to fully tear down + reboot
  // the Scorm12API + iframe (i.e. on SCO change). The iframe's `key` ties to
  // this so React unmounts the old DOM completely.
  const [apiBootCounter, setApiBootCounter] = useState(0);
  const [apiReady, setApiReady] = useState(false);

  // Extracted to a variable so the boot useEffect's dep array stays statically
  // checkable (react-hooks/exhaustive-deps doesn't allow expressions).
  const enrollmentLoaded = enrollment !== undefined;
  const currentScoId = currentUnit?.scoId ?? null;

  // Track the SCO whose suspend_data was hydrated into the CURRENT api
  // instance. WHY: we need the api to boot AFTER the latest scoStates arrive
  // (initial useQuery returns undefined). If we boot before, suspend_data
  // hydration is a no-op.
  const hydratedScoIdRef = useRef<string | null>(null);

  // Boot / re-boot the Scorm12API. Runs:
  //   1. once enrollment query resolves (initial load — hydrate before iframe),
  //   2. every time the user picks a different SCO,
  //   3. on courseId / learnerId change (unlikely, but Hook safety).
  useEffect(() => {
    // Wait until we have at least an initial enrollment snapshot. Without
    // this, mounting the api with empty suspend_data would race against the
    // first useQuery resolve and the SCO would boot stateless.
    if (enrollment === undefined) return;
    if (!currentUnit) return;

    const scoState = scoStates[currentUnit.scoId];
    const scormApi = new Scorm12API({ autocommit: false });

    // CROSS-SESSION RESUME — hydrate BEFORE the iframe LMSInitialize call.
    // Per scorm-again's internals, cmi.suspend_data is read by the content via
    // LMSGetValue("cmi.suspend_data"); that read returns whatever string we
    // assigned here. Assigning AFTER LMSInitialize would still work for
    // GetValue, but content typically reads suspend_data DURING init handlers,
    // so we set it now to cover both timings.
    if (scoState?.suspendData) {
      try {
        scormApi.cmi.suspend_data = scoState.suspendData;
      } catch {
        /* noop — defensive: scorm-again surface is loose-typed */
      }
    }
    // Restoring lesson_status is intentionally NOT done here. The content's
    // own wrapper may overwrite it on first commit; the canonical state lives
    // in convex/lmsEnrollments.scoStates and the UI reads from there. Keeping
    // cmi.core.lesson_status at its scorm-again default avoids confusing the
    // CAMPUS wrapper which expects "not attempted" on first GetValue.

    const forward = (
      element: string,
      value: string,
      commitId?: string
    ) => {
      const eid = enrollmentRef.current;
      const sid = currentScoIdRef.current;
      if (!eid || !sid) return;
      // Fire-and-forget; Convex is reactive so the UI updates on its own.
      void recordScormEvent({
        learnerId,
        enrollmentId: eid,
        scoId: sid,
        element,
        value,
        commitId,
      });
    };

    let commitCounter = 0;
    const currentCommitId = () => `commit-${commitCounter}`;

    scormApi.on("LMSSetValue", (element: string, value: string) => {
      forward(element, String(value), currentCommitId());
    });
    scormApi.on("LMSCommit", () => {
      forward("__commit__", currentCommitId());
      commitCounter += 1;
    });
    scormApi.on("LMSFinish", () => {
      forward("__finish__", new Date().toISOString());
    });

    window.API = scormApi;
    hydratedScoIdRef.current = currentUnit.scoId;
    setApiReady(true);

    return () => {
      try {
        scormApi.clear("LMSSetValue");
        scormApi.clear("LMSCommit");
        scormApi.clear("LMSFinish");
      } catch {
        /* noop */
      }
      if (window.API === scormApi) {
        delete window.API;
      }
      setApiReady(false);
    };
    // We intentionally depend on apiBootCounter + currentScoId so a SCO
    // switch reboots; suspend_data only re-hydrates on those transitions.
    // enrollmentLoaded gates the initial mount until useQuery resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    recordScormEvent,
    learnerId,
    apiBootCounter,
    currentScoId,
    enrollmentLoaded,
  ]);

  // SCO selection. Bumps the boot counter so the api/iframe rebuilds.
  const selectSco = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= units.length) return;
      if (idx === currentIdx) return;
      setCurrentIdx(idx);
      setApiBootCounter((c) => c + 1);
    },
    [units.length, currentIdx]
  );

  // Keyboard nav: arrow keys move focus between SCO buttons; Enter selects.
  // WHY roving tabIndex pattern: a single tab stop into the nav, then arrows
  // navigate within. Matches WAI-ARIA Authoring Practices "tablist".
  const navButtonsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const onNavKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        const next = (idx + 1) % units.length;
        navButtonsRef.current[next]?.focus();
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        const prev = (idx - 1 + units.length) % units.length;
        navButtonsRef.current[prev]?.focus();
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectSco(idx);
      } else if (e.key === "Home") {
        e.preventDefault();
        navButtonsRef.current[0]?.focus();
      } else if (e.key === "End") {
        e.preventDefault();
        navButtonsRef.current[units.length - 1]?.focus();
      }
    },
    [units.length, selectSco]
  );

  const iframeSrc =
    apiReady && currentUnit?.href
      ? `/api/lms/asset/${encodeURIComponent(slug)}/${currentUnit.href
          .split("/")
          .map(encodeURIComponent)
          .join("/")}`
      : undefined;

  const progress = enrollment?.progressPercent ?? 0;
  const totalScos = units.length;
  const completedCount = enrollment?.completedScoCount ?? 0;
  const multiSco = totalScos > 1;

  return (
    <div className={styles.player}>
      <header className={styles.header}>
        <h1 className={styles.title}>{courseTitle}</h1>
        <Link href="/cursos/privacidad" className={styles.privacyLink}>
          Privacidad de mi progreso
        </Link>
        <div className={styles.progressRow}>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progreso del curso"
          >
            <div
              className={styles.progressFill}
              style={{ width: `${progress}%` }}
            />
          </div>
          <small className={styles.progressLabel}>
            Progreso: {progress}%
            {multiSco ? ` · Módulos: ${completedCount}/${totalScos}` : ""} ·
            Estado: {enrollment?.lessonStatus ?? "—"} · Puntaje:{" "}
            {enrollment?.scoreRaw ?? "—"}
          </small>
        </div>
      </header>

      <div className={styles.body}>
        {/* SCO navigation. Sidebar when multiSco; collapsed otherwise so the
            single-SCO path looks identical to D01. */}
        {multiSco ? (
          <nav
            className={styles.nav}
            aria-label="Navegación entre módulos del curso"
          >
            <strong className={styles.navHeading}>MÓDULOS</strong>
            <ul className={styles.navList} role="tablist" aria-orientation="vertical">
              {units.map((u, idx) => {
                const state = scoStates[u.scoId];
                const isCurrent = idx === currentIdx;
                const isCompleted =
                  state?.lessonStatus !== undefined &&
                  TERMINAL_COMPLETE.has(state.lessonStatus);
                return (
                  <li key={u.scoId} className={styles.navItem}>
                    <button
                      ref={(el) => {
                        navButtonsRef.current[idx] = el;
                      }}
                      role="tab"
                      aria-selected={isCurrent}
                      aria-current={isCurrent ? "true" : undefined}
                      tabIndex={isCurrent ? 0 : -1}
                      className={`${styles.navButton} ${
                        isCurrent ? styles.navButtonActive : ""
                      }`}
                      onClick={() => selectSco(idx)}
                      onKeyDown={(e) => onNavKeyDown(e, idx)}
                    >
                      <span className={styles.navButtonTitle}>{u.title}</span>
                      {isCompleted && (
                        <span
                          aria-hidden="true"
                          className={styles.navCheck}
                          title="Completado"
                        >
                          ✓
                        </span>
                      )}
                      {isCompleted && (
                        <span className={styles.srOnly}>Completado</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : null}

        {/* The SCO iframe. Same-origin via the asset proxy so the
            provider wrapper can reach window.parent.API. The key includes
            apiBootCounter so a SCO swap forces a full DOM rebuild. */}
        <main className={styles.main}>
          {iframeSrc ? (
            <iframe
              key={`${apiBootCounter}-${iframeSrc}`}
              src={iframeSrc}
              title={courseTitle}
              sandbox="allow-scripts allow-same-origin"
              className={styles.iframe}
            />
          ) : (
            <div className={styles.empty}>Inicializando SCORM API…</div>
          )}
        </main>
      </div>
    </div>
  );
}
