import sanitizeHtml from "sanitize-html";
import { resolveCourseDescriptionParagraphs } from "@/lib/course-catalog";
import { stripHtmlToParagraphs } from "@/lib/strip-html";

/**
 * Rich-text -> SAFE rich-text, for the "Sobre este curso" body of the course
 * detail page.
 *
 * WHY THIS EXISTS. `lmsCourses.description` is HTML written from the panel's
 * rich-text editor, and the detail page is public. Rendering it as markup
 * means a compromised panel account could otherwise inject script into the
 * Academia, so the HTML goes through a CLOSED allow-list before it reaches
 * `dangerouslySetInnerHTML`. Anything not on the list is dropped.
 *
 * WHY sanitize-html AND NOT DOMPurify. The page renders server-side in a plain
 * Node runtime with no DOM (see strip-html.ts), and the formatted body has to
 * be in the server HTML (SEO, no empty block before hydration). sanitize-html
 * parses with htmlparser2 and runs in Node as-is.
 *
 * The list is the one the content team needs: text styles, lists, headings,
 * quotes and links. Images, embeds and tables are intentionally out.
 */
export const DESCRIPTION_ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
  "h4",
  "blockquote",
  "a",
] as const;

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...DESCRIPTION_ALLOWED_TAGS],
  // `rel` and `target` are listed only so the values forced by transformTags
  // survive the attribute filter; the transform overwrites whatever the
  // source carried, so the author cannot choose them.
  allowedAttributes: { a: ["href", "rel", "target"] },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: {},
  allowedSchemesAppliedToAttributes: ["href"],
  allowProtocolRelative: false,
  // Disallowed tags are removed but their text is kept ("discard" mode);
  // these three go together with everything inside them.
  disallowedTagsMode: "discard",
  nonTextTags: ["script", "style", "iframe"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      rel: "noopener noreferrer",
      target: "_blank",
    }),
  },
};

export function sanitizeCourseDescription(html: string): string {
  if (!html) return "";
  return sanitizeHtml(html, OPTIONS);
}

/**
 * The written description of a course, sanitized, or `null` when there is
 * none — in which case the detail page keeps its SCO-derived stand-in.
 *
 * "There is a written description" uses the SAME rule as the plain-text
 * surfaces (`resolveCourseDescriptionParagraphs`, which also feeds the meta
 * description): an empty or `&nbsp;`-only field counts as no description.
 * The sanitized result is checked again because the allow-list can leave
 * nothing behind (a field holding only a `<script>`), and an empty body must
 * fall back too instead of showing a blank "Sobre este curso".
 */
export function resolveCourseDescriptionHtml(course: {
  description?: string;
}): string | null {
  if (resolveCourseDescriptionParagraphs(course).length === 0) return null;
  const safe = sanitizeCourseDescription(course.description ?? "");
  if (stripHtmlToParagraphs(safe).length === 0) return null;
  return safe;
}
