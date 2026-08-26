/**
 * Rich-text -> plain text, for surfaces that must show a short PLAIN
 * excerpt of an editor field (T-07, M-HOME amendment).
 *
 * WHY THIS EXISTS. `lmsCourses.description` (schema.ts) is written from a
 * rich-text editor in the panel — it is HTML, not Markdown or plain text.
 * The public catalog card renders its description through plain JSX text
 * interpolation (`{description}`, CourseCard.tsx), which does NOT parse
 * HTML: handing it raw markup would print the tags themselves on screen
 * ("<p>Hola</p>" verbatim) instead of stripping them. This function is the
 * fix — a pure string transform, deliberately NOT using DOMParser/innerHTML:
 * this repo has no jsdom (vitest.config.ts, on purpose) and these pages
 * render server-side in a plain Node runtime with no DOM available at all,
 * so a browser-API-based stripper would not run in either place it needs
 * to. A small block-aware regex pass covers the shape of what the editor
 * actually emits (paragraphs, line breaks, basic inline marks, lists) well
 * enough for a short card excerpt; it is not a general HTML sanitizer and
 * must never be used to render trusted markup back into the DOM.
 */
export function stripHtmlToText(html: string): string {
  if (!html) return "";

  const withWordBoundaries = html
    // Block-level closing tags (and <br>) become a single space so words
    // from adjacent elements never collide: "<p>Hola</p><p>Mundo</p>" must
    // become "Hola Mundo", not "HolaMundo".
    .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6]|\/blockquote|\/tr)\s*\/?>/gi, " ")
    // Everything else (any opening or unhandled tag) is dropped outright —
    // it carries no text of its own to preserve.
    .replace(/<[^>]+>/g, "");

  const decoded = withWordBoundaries
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'");

  return decoded.replace(/\s+/g, " ").trim();
}
