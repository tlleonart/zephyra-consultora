// The public door to the button visual contract.
//
// Consumers get a CLASS STRING, not a component, so the element stays theirs:
// <Link>, <a>, <button> and <input type="submit"> all opt in identically.
// That is the whole point — see button.module.css for why merging the marketing
// CTAs into <Button> would have broken navigation.
//
// The CSS Module is imported HERE, inside @zephyra/ui, so no app has to import a
// package stylesheet: the hashed class names travel as data. <Button> calls this
// too, which is what makes the contract single-source.
import styles from './button.module.css';

export type BtnVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'ghost'
  | 'inverse'
  | 'outline';
export type BtnSize = 'sm' | 'md' | 'lg';

export interface BtnClassOptions {
  variant?: BtnVariant;
  size?: BtnSize;
  /** width: 100% — the sticky purchase panel and the checkout card use this. */
  block?: boolean;
  /** Inside a full-green band: switches the focus ring to sand so it is visible. */
  onGreen?: boolean;
  loading?: boolean;
  /** Appended last, so a call site can still add its own layout class. */
  className?: string;
}

export function btnClass({
  variant = 'primary',
  size = 'md',
  block,
  onGreen,
  loading,
  className,
}: BtnClassOptions = {}): string {
  return [
    styles.btn,
    styles[variant],
    styles[size],
    block ? styles.block : null,
    onGreen ? styles.onGreen : null,
    loading ? styles.loading : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

/** The spinner class, for consumers that render their own loading indicator. */
export const btnSpinnerClass: string = styles.spinner;
