/**
 * Minimal SCORM 1.2 imsmanifest.xml parser.
 *
 * The Convex runtime has no DOMParser, so this is a small, dependency-free
 * parser tuned for the SCORM 1.2 IMS Content Packaging shape that CAMPUS
 * produces. It extracts the organization title, the ordered items, and the
 * resources (with their launch href).
 *
 * E03 (PDD §7.1): parser is STRICT. Malformed XML, wrong SCORM version, or
 * missing required structural elements throw ManifestValidationError so the
 * ingestion path can surface a precise, user-facing reason instead of inserting
 * a half-built course row. The strict mode replaces the prior Sprint-0
 * permissive behavior that returned an empty shell on bad input.
 */

export interface ScormItem {
  identifier: string;
  identifierref: string | null;
  title: string;
}

export interface ScormResource {
  identifier: string;
  scormType: string | null; // "sco" | "asset" | null
  href: string | null;
  files: string[];
}

export interface ParsedManifest {
  title: string | null;
  organizations: { identifier: string | null; title: string | null; items: ScormItem[] };
  resources: ScormResource[];
  /** Resolved launch path for the player: first item's resource href. */
  entryPoint: string | null;
}

export type ManifestErrorCode = "malformed" | "wrong-version" | "missing-fields";

/**
 * Strict-parse failure. Carries a stable `code` so the UI can render a
 * purpose-specific message in Spanish without scraping the string.
 */
export class ManifestValidationError extends Error {
  readonly code: ManifestErrorCode;
  constructor(code: ManifestErrorCode, message: string) {
    super(message);
    this.name = "ManifestValidationError";
    this.code = code;
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i"));
  return m ? decodeEntities(m[1]) : null;
}

function firstTagContent(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? decodeEntities(m[1].trim()) : null;
}

/**
 * Cheap structural sanity check on the XML payload. Convex runtime has no
 * DOMParser, so this catches the "totally not XML" cases (empty string, no
 * tags at all, opening with non-XML data) without pretending to validate the
 * full grammar.
 */
function isXmlLike(xml: string): boolean {
  const trimmed = xml.trim();
  if (!trimmed) return false;
  // Must contain at least one tag pair pattern.
  if (!/<[^>]+>/.test(trimmed)) return false;
  // First non-whitespace, non-prolog character must be `<`.
  const stripped = trimmed.replace(/^<\?xml[^?]*\?>\s*/i, "").replace(/^<!--[\s\S]*?-->\s*/g, "");
  if (!stripped.startsWith("<")) return false;
  return true;
}

export function parseScormManifest(xml: string): ParsedManifest {
  // --- Structural gate: looks like XML at all? ---
  if (!isXmlLike(xml)) {
    throw new ManifestValidationError(
      "malformed",
      "El imsmanifest.xml está vacío o no es XML válido."
    );
  }

  // --- <manifest> root must exist with at least one attribute (identifier or version). ---
  const manifestOpenMatch = xml.match(/<manifest\b([^>]*)>/i);
  if (!manifestOpenMatch) {
    throw new ManifestValidationError(
      "malformed",
      "No se encontró el elemento raíz <manifest> en imsmanifest.xml."
    );
  }
  const manifestAttrsTag = `<manifest ${manifestOpenMatch[1]}>`;
  const manifestIdentifier = attr(manifestAttrsTag, "identifier");
  if (!manifestIdentifier) {
    throw new ManifestValidationError(
      "missing-fields",
      "El elemento <manifest> no tiene el atributo identifier requerido."
    );
  }

  // --- Schema version gate: SCORM 1.2 only. ---
  // The schemaversion lives inside <metadata>; if metadata or schemaversion is
  // absent we treat it as missing-fields, not wrong-version, so the UI can
  // distinguish "you forgot it" from "you sent us SCORM 2004".
  const schemaVersion = firstTagContent(xml, "schemaversion");
  if (!schemaVersion) {
    throw new ManifestValidationError(
      "missing-fields",
      "Falta <schemaversion> en <metadata>. Se requiere SCORM 1.2."
    );
  }
  if (schemaVersion.trim() !== "1.2") {
    throw new ManifestValidationError(
      "wrong-version",
      `Versión SCORM no soportada: "${schemaVersion}". Sólo se acepta SCORM 1.2.`
    );
  }

  // --- <organizations> must exist (we don't require items inside; ingest
  //     surfaces entryPoint=null downstream, but the wrapper must be present). ---
  const orgsBlockMatch = xml.match(/<organizations\b[^>]*>([\s\S]*?)<\/organizations>/i);
  if (!orgsBlockMatch) {
    throw new ManifestValidationError(
      "missing-fields",
      "Falta el elemento <organizations> en el manifest."
    );
  }

  // --- Organization (first <organization> block) ---
  const orgBlockMatch = xml.match(/<organization\b[^>]*>([\s\S]*?)<\/organization>/i);
  const orgBlock = orgBlockMatch ? orgBlockMatch[1] : "";
  const orgOpenTag = orgBlockMatch
    ? xml.slice(orgBlockMatch.index!, xml.indexOf(">", orgBlockMatch.index!) + 1)
    : "";
  const orgIdentifier = orgOpenTag ? attr(orgOpenTag, "identifier") : null;
  const orgTitle = orgBlock ? firstTagContent(orgBlock, "title") : null;

  // --- Items (direct + nested; we keep their order of appearance) ---
  const items: ScormItem[] = [];
  const itemRe = /<item\b([^>]*)>([\s\S]*?)<\/item>/gi;
  let im: RegExpExecArray | null;
  while ((im = itemRe.exec(orgBlock)) !== null) {
    const openAttrs = im[1];
    const inner = im[2];
    items.push({
      identifier: attr(`<item ${openAttrs}>`, "identifier") || "",
      identifierref: attr(`<item ${openAttrs}>`, "identifierref"),
      title: firstTagContent(inner, "title") || "",
    });
  }

  // --- Resources: <resources> wrapper required and must contain ≥ 1 <resource>. ---
  const resBlockMatch = xml.match(/<resources\b[^>]*>([\s\S]*?)<\/resources>/i);
  if (!resBlockMatch) {
    throw new ManifestValidationError(
      "missing-fields",
      "Falta el elemento <resources> en el manifest."
    );
  }
  const resBlock = resBlockMatch[1];

  const resources: ScormResource[] = [];
  // Match both self-closing and paired <resource> tags.
  const resRe = /<resource\b([^>]*?)(?:\/>|>([\s\S]*?)<\/resource>)/gi;
  let rm: RegExpExecArray | null;
  while ((rm = resRe.exec(resBlock)) !== null) {
    const openAttrs = rm[1];
    const inner = rm[2] || "";
    const openTag = `<resource ${openAttrs}>`;
    const files: string[] = [];
    const fileRe = /<file\b([^>]*?)\/?>/gi;
    let fm: RegExpExecArray | null;
    while ((fm = fileRe.exec(inner)) !== null) {
      const href = attr(`<file ${fm[1]}>`, "href");
      if (href) files.push(href);
    }
    resources.push({
      identifier: attr(openTag, "identifier") || "",
      scormType:
        attr(openTag, "adlcp:scormtype") || attr(openTag, "scormtype") || null,
      href: attr(openTag, "href"),
      files,
    });
  }

  if (resources.length === 0) {
    throw new ManifestValidationError(
      "missing-fields",
      "El elemento <resources> está vacío. Se requiere al menos un <resource>."
    );
  }

  // --- Entry point resolution: first item -> its resource -> href ---
  let entryPoint: string | null = null;
  for (const it of items) {
    if (!it.identifierref) continue;
    const res = resources.find((r) => r.identifier === it.identifierref);
    if (res?.href) {
      entryPoint = res.href;
      break;
    }
  }
  // Fallback: first SCO resource with an href.
  if (!entryPoint) {
    const firstSco = resources.find(
      (r) => r.href && (r.scormType === "sco" || r.scormType === null)
    );
    entryPoint = firstSco?.href ?? null;
  }

  return {
    title: orgTitle,
    organizations: { identifier: orgIdentifier, title: orgTitle, items },
    resources,
    entryPoint,
  };
}
