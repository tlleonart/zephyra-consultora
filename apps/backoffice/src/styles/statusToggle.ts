/**
 * The public door to the status-toggle geometry (T-a11y-002).
 *
 * Same shape as packages/ui's `btnClass`: consumers get a CLASS STRING, not a
 * component, because the six call sites each need to keep their own tone class
 * (`styles.published` / `styles.draft` / `styles.active` / ...) alongside it.
 * The CSS Module is imported HERE so the hashed name travels as data and no
 * feature has to know where the stylesheet lives.
 *
 * This lives in apps/backoffice, not in packages/ui, ON PURPOSE: a clickable
 * status pill in an admin table is not a shared primitive, and anything added to
 * packages/ui ships as bytes into apps/www and apps/academia, which this task
 * must leave byte-identical.
 */
import styles from './statusToggle.module.css';

/**
 * Geometry + boundary for a clickable status pill. Combine with the call site's
 * own tone class, which supplies `background-color` and `color`:
 *
 *   className={`${statusToggleClass()} ${isActive ? s.active : s.inactive}`}
 *
 * Do NOT apply it to a non-interactive <span>: the border is the app's signal
 * that a status chip can be clicked.
 */
export function statusToggleClass(className?: string): string {
  return [styles.statusToggle, className].filter(Boolean).join(' ');
}
