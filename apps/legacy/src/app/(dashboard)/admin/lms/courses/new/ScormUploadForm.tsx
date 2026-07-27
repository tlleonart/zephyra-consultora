"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction, useMutation } from "convex/react";
import JSZip from "jszip";
import { api } from "@zephyra/convex/_generated/api";
import type { Id } from "@zephyra/convex/_generated/dataModel";

/**
 * SCORM ingestion form (Phase D — AC-D01.1 .. AC-D01.4; E03 polish).
 *
 * Flow (all client-side until ingestScormPackage):
 *   1) admin picks the .zip from disk (E03: type+size validated before unzip)
 *   2) JSZip reads it in-memory, filters `.bak.*` entries -> (path, blob) pairs
 *   3) per file: generateUploadUrl() -> POST blob -> collect Id<"_storage">,
 *      parallelized in batches so the ~29 MB / ~50-file ingest stays < ~60s
 *   4) ingestScormPackage({ campusCourseId, files: [(path, storageId)] })
 *      reads imsmanifest.xml back from _storage and inserts the lmsCourses row
 *
 * E03 error states map the action's purpose-specific failures
 * (ManifestValidationError code, archive-on-duplicate notice, generic) to
 * Spanish copy.
 */

const UPLOAD_CONCURRENCY = 8;
const MAX_ZIP_BYTES = 100 * 1024 * 1024;

interface FileEntry {
  path: string;
  blob: Blob;
}

type Phase = "idle" | "unzipping" | "uploading" | "ingesting" | "done" | "error";

interface ScormUploadFormProps {
  userId: Id<"adminUsers">;
}

interface IngestSuccess {
  slug: string;
  parseMs: number;
  fileCount: number;
  archivedPriorCount: number;
  title: string;
}

interface IngestError {
  message: string;
  // Surfaced via the validation-error code in the action error message.
  hint?: string;
}

/**
 * Convex actions wrap thrown errors with a Convex prefix; we look for the
 * ManifestValidationError code marker the parser embeds and surface a
 * purpose-specific Spanish message. Falls back to a generic detail line.
 */
function describeIngestError(err: unknown): IngestError {
  const raw = err instanceof Error ? err.message : String(err);
  // Convex action error format includes the original message; we match on
  // the validation-error code substrings.
  if (/Versi.n SCORM no soportada/i.test(raw) || /wrong-version/i.test(raw)) {
    return {
      message:
        "El manifest del paquete SCORM no es válido (versión incorrecta). Verificá que el archivo sea SCORM 1.2.",
      hint: "wrong-version",
    };
  }
  if (
    /no es XML/i.test(raw) ||
    /elemento ra.z <manifest>/i.test(raw) ||
    /malformed/i.test(raw)
  ) {
    return {
      message:
        "El manifest del paquete SCORM no es válido (malformado). Verificá que el archivo sea SCORM 1.2.",
      hint: "malformed",
    };
  }
  if (
    /missing-fields/i.test(raw) ||
    /Falta <schemaversion>/i.test(raw) ||
    /Falta el elemento <organizations>/i.test(raw) ||
    /Falta el elemento <resources>/i.test(raw) ||
    /no tiene el atributo identifier/i.test(raw) ||
    /<resources> est.* vac.o/i.test(raw)
  ) {
    return {
      message:
        "El manifest del paquete SCORM no es válido (campos requeridos faltantes). Verificá que el archivo sea SCORM 1.2.",
      hint: "missing-fields",
    };
  }
  if (/imsmanifest\.xml not found/i.test(raw)) {
    return {
      message:
        "No se encontró imsmanifest.xml en el paquete. Verificá que el zip sea SCORM 1.2 con el manifest en la raíz.",
    };
  }
  return { message: `Error inesperado durante la ingesta. Detalle: ${raw}` };
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
  const [result, setResult] = useState<IngestSuccess | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [ingestError, setIngestError] = useState<IngestError | null>(null);

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

  function validateFile(file: File): string | null {
    const isZipName = /\.zip$/i.test(file.name);
    const isZipMime =
      file.type === "application/zip" ||
      file.type === "application/x-zip-compressed" ||
      file.type === ""; // some browsers omit type for .zip
    if (!isZipName || !isZipMime) {
      return "El archivo debe ser un paquete .zip de SCORM 1.2.";
    }
    if (file.size > MAX_ZIP_BYTES) {
      return "El archivo excede el tamaño máximo (100 MB).";
    }
    return null;
  }

  async function handleFile(file: File) {
    setLog([]);
    setResult(null);
    setIngestError(null);
    setValidationError(null);
    setProgress({ done: 0, total: 0 });

    const fileErr = validateFile(file);
    if (fileErr) {
      setValidationError(fileErr);
      setPhase("error");
      return;
    }

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
      if (r.archivedPriorCount > 0) {
        addLog(`Se archivaron ${r.archivedPriorCount} versión(es) anterior(es).`);
      }
      setResult({
        slug: r.slug,
        parseMs: r.parseMs,
        fileCount: r.fileCount,
        archivedPriorCount: r.archivedPriorCount,
        title: r.title,
      });
      setPhase("done");
    } catch (err) {
      const described = describeIngestError(err);
      setIngestError(described);
      addLog(`ERROR: ${described.message}`);
      setPhase("error");
    }
  }

  const busy =
    phase === "unzipping" || phase === "uploading" || phase === "ingesting";
  const uploadPercent =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <section style={{ maxWidth: 760, padding: "2rem" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>Ingestar curso SCORM</h1>
      <p style={{ color: "#666", marginBottom: "1.5rem" }}>
        Seleccioná un paquete SCORM 1.2 (.zip, hasta 100 MB). Se descomprime en
        el navegador, se suben los archivos a Convex <code>_storage</code> y se
        parsea el manifest para crear el curso en estado borrador.
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
          <span>Paquete SCORM (.zip, máx. 100 MB)</span>
          <input
            type="file"
            accept=".zip"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
        </label>
      </div>

      {validationError && (
        <div
          role="alert"
          style={{
            padding: "0.75rem 1rem",
            background: "#fdecea",
            border: "1px solid #f5c2c0",
            borderRadius: 8,
            marginBottom: "1rem",
            color: "#7a1310",
          }}
        >
          {validationError}
        </div>
      )}

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
                width: `${uploadPercent}%`,
                background: "#2d7",
                transition: "width 0.2s",
              }}
            />
          </div>
          <small>
            Subiendo archivo {progress.done} de {progress.total} ({uploadPercent}%)
          </small>
        </div>
      )}

      {ingestError && (
        <div
          role="alert"
          style={{
            padding: "1rem",
            background: "#fdecea",
            border: "1px solid #f5c2c0",
            borderRadius: 8,
            marginBottom: "1rem",
            color: "#7a1310",
          }}
        >
          <strong>No se pudo ingestar el paquete.</strong>
          <div style={{ marginTop: 6 }}>{ingestError.message}</div>
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
          {result.archivedPriorCount > 0 && (
            <div style={{ marginTop: 8, color: "#555" }}>
              Curso publicado como nueva versión. La versión anterior queda
              archivada para los alumnos ya inscritos.
            </div>
          )}
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
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
            <button
              onClick={() => router.push("/admin/lms")}
              style={{
                padding: "8px 14px",
                background: "#fff",
                border: "1px solid #ccc",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Volver al listado
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
