import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@zephyra/utils';
// Button no longer OWNS its styles: it is one consumer of the shared, element-
// agnostic contract in ../../../styles/button.module.css, alongside every <Link>
// and <a> CTA that used to reimplement it in an app-local CSS Module. The DOM
// this component renders is UNCHANGED, and so is its public API — `variant`
// merely gains `inverse` and `outline`.
import { btnClass, btnSpinnerClass } from '../../../styles/btn';
import type { BtnSize, BtnVariant } from '../../../styles/btn';

export type ButtonVariant = BtnVariant;
export type ButtonSize = BtnSize;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(btnClass({ variant, size, loading }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <span className={btnSpinnerClass} />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
