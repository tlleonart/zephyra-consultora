/**
 * The "Sobre este curso" body of the course detail page.
 *
 * `html` MUST come from `resolveCourseDescriptionHtml` (lib/sanitize-description):
 * it is the written description already passed through the allow-list, so it
 * is safe to hand to `dangerouslySetInnerHTML`. This is a server component, so
 * the formatted markup ships in the server HTML, not only after hydration.
 *
 * When there is no written description (`html === null`) the SCO-derived
 * stand-in renders exactly as before: one plain paragraph.
 */
export function CourseDescriptionBody({
  html,
  fallback,
  className,
}: {
  html: string | null;
  fallback: string;
  className?: string;
}) {
  if (html === null) {
    return (
      <div className={className}>
        <p>{fallback}</p>
      </div>
    );
  }
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
