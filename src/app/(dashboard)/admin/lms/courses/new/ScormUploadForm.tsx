"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction, useMutation } from "convex/react";
import JSZip from "jszip";
import { api } from "../../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../../convex/_generated/dataModel";

/**
 * SCORM ingestion form (Phase D — AC-D01.1 .. AC-D01.4).
 *
 * Flow (all client-side until ingestScormPackage):
 *   1) admin picks the .zip from disk
 *   2) JSZip reads it in-memory, filters `.bak.*` entries -> (path, blob) pairs
 *   3) per file: generateUploadUrl() -> POST blob -> collect Id<"_storage">,
 *      parallelized in batches so the ~29 MB / ~50-file ingest stays < ~60s
 *   4) ingestScormPackage({ campusCourseId, files: [(path, storageId)] })
 *      reads imsmanifest.xml back from _storage and inserts the lmsCourses row
 */

const UPLOAD_CONCURRENCY = 8;

interface FileEntry {
  path: string;
  blob: Blob;
}

type Phase = "idle" | "unzipping" | "uploading" | "ingesting" | "done" | "error";

interface ScormUploadFormProps {
  userId: Id<"adminUsers">;
}

// userId is propped from the server-side session (admin-only route) and passed
// to ingestScormPackage so the action's requireRole("admin") gate succeeds.
export function ScormUploadForm({ userId }: ScormUploadFormProps) {
  const router = useRouter();
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const ingestScormPackage = useAction(api.lms.courses.ingestScormPackage);

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [campusCourseId, setCampusCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<{
    slug: string;
    parseMs: number;
    fileCount: number;
  } | null>(null);

  const addLog = (line: string) =>
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()}  ${line}`]);

  async function uploadOne(entry: FileEntry): Promise<{ path: string; storageId: Id<"_storage"> }> {
    const url = await generateUploadUrl();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": entry.blob.type || "application/octet-stream" },
      body: entry.blob,
    });
    if (!res.ok) throw new Error(`Upload failed for ${entry.path}: ${res.status}`);
    const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
    return { path: entry.path, storageId };
  }

  async function handleFile(file: File) {
    setLog([]);
    setResult(null);
    setProgress({ done: 0, total: 0 });

    try {
      // --- Step 1+2: unzip + filter .bak ---
      setPhase("unzipping");
      addLog(`Leyendo ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)...`);
      const zip = await JSZip.loadAsync(file);

      const entries: FileEntry[] = [];
      const skipped: string[] = [];
      const names = Object.keys(zip.files);
      for (const name of names) {
        const zf = zip.files[name];
        if (zf.dir) continue;
        // Filter .bak / .bak.* backup files the provider ships (AC-D01.2).
        if (/\.bak(\.|$)/i.test(name)) {
          skipped.push(name);
          continue;
        }
        const blob = await zf.async("blob");
        entries.push({ path: name.replace(/\\/g, "/"), blob });
      }
      addLog(`Descomprimido: ${entries.length} archivos, ${skipped.length} .bak omitidos.`);

      const inferredCampusId =
        campusCourseId.trim() ||
        // Derive a stable id from the manifest identifier if present, else filename.
        file.name.replace(/\.zip$/i, "");
      addLog(`campusCourseId: ${inferredCampusId}`);

      // --- Step 3: parallel uploads in batches ---
      setPhase("uploading");
      setProgress({ done: 0, total: entries.length });
      const uploaded: { path: string; storageId: Id<"_storage"> }[] = [];
      let cursor = 0;
      async function worker() {
        while (cursor < entries.length) {
          const idx = cursor++;
          const r = await uploadOne(entries[idx]);
          uploaded.push(r);
          setProgress((p) => ({ ...p, done: p.done + 1 }));
        }
      }
      const t0 = performance.now();
      await Promise.all(
        Array.from({ length: Math.min(UPLOAD_CONCURRENCY, entries.length) }, worker)
      );
      addLog(
        `Subida completa: ${uploaded.length} archivos en ${((performance.now() - t0) / 1000).toFixed(1)}s.`
      );

      // --- Step 4: ingest ---
      setPhase("ingesting");
      addLog("Parseando imsmanifest.xml e insertando lmsCourses...");
      const r = await ingestScormPackage({
        userId,
        campusCourseId: inferredCampusId,
        title: title.trim() || undefined,
        files: uploaded,
      });
      addLog(
        `Curso creado: "${r.title}" (slug: ${r.slug}). Manifest parse: ${r.parseMs}ms.`
      );
      setResult({ slug: r.slug, parseMs: r.parseMs, fileCount: r.fileCount });
      setPhase("done");
    } catch (err) {
      addLog(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
      setPhase("error");
    }
  }

  const busy =
    phase === "unzipping" || phase === "uploading" || phase === "ingesting";

  return (
    <section style={{ maxWidth: 760, padding: "2rem" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>Ingestar curso SCORM</h1>
      <p style={{ color: "#666", marginBottom: "1.5rem" }}>
        Seleccioná un paquete SCORM 1.2 (.zip). Se descomprime en el navegador,
        se suben los archivos a Convex <code>_storage</code> y se parsea el
        manifest para crear el curso en estado borrador.
      </p>

      <div style={{ display: "grid", gap: "1rem", marginBottom: "1.5rem" }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span>campusCourseId (opcional — se infiere del archivo)</span>
          <input
            value={campusCourseId}
            onChange={(e) => setCampusCourseId(e.target.value)}
            placeholder="CAMPUS_CURSO_355_1775833979"
            disabled={busy}
            style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span>Título (opcional — se infiere del manifest)</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Diversidad, equidad e inclusión en el trabajo"
            disabled={busy}
            style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span>Paquete SCORM (.zip)</span>
          <input
            type="file"
            accept=".zip,application/zip"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
        </label>
      </div>

      {progress.total > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <div
            style={{
              height: 10,
              background: "#eee",
              borderRadius: 5,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${(progress.done / progress.total) * 100}%`,
                background: "#2d7",
                transition: "width 0.2s",
              }}
            />
          </div>
          <small>
            {phase} — {progress.done}/{progress.total} archivos
          </small>
        </div>
      )}

      {result && (
        <div
          style={{
            padding: "1rem",
            background: "#eefbf2",
            border: "1px solid #b9e8cd",
            borderRadius: 8,
            marginBottom: "1rem",
          }}
        >
          <strong>Curso ingestado.</strong> {result.fileCount} archivos. Manifest
          parse: {result.parseMs}ms.
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => router.push(`/cursos/${result.slug}/player`)}
              style={{
                padding: "8px 14px",
                background: "#2d7",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Abrir player →
            </button>
          </div>
        </div>
      )}

      {log.length > 0 && (
        <pre
          style={{
            background: "#111",
            color: "#9f9",
            padding: "1rem",
            borderRadius: 8,
            fontSize: 12,
            maxHeight: 240,
            overflow: "auto",
          }}
        >
          {log.join("\n")}
        </pre>
      )}
    </section>
  );
}
