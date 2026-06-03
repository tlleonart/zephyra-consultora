/**
 * Minimal SCORM 1.2 imsmanifest.xml parser.
 *
 * The Convex runtime has no DOMParser, so this is a small, dependency-free
 * parser tuned for the SCORM 1.2 IMS Content Packaging shape that CAMPUS
 * produces. It extracts the organization title, the ordered items, and the
 * resources (with their launch href). It is intentionally tolerant: it reads
 * the attributes it needs via regex rather than validating the whole schema.
 *
 * If a future package uses a structure this parser cannot read, ingestion
 * surfaces it (entryPoint resolution falls back), rather than failing silently.
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

export function parseScormManifest(xml: string): ParsedManifest {
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

  // --- Resources ---
  const resources: ScormResource[] = [];
  const resBlockMatch = xml.match(/<resources\b[^>]*>([\s\S]*?)<\/resources>/i);
  const resBlock = resBlockMatch ? resBlockMatch[1] : "";
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
