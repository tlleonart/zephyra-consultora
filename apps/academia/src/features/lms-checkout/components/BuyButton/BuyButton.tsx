"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCheckout } from "@/features/lms-checkout/actions/create-checkout";
import type { Id } from "@zephyra/convex/_generated/dataModel";
import styles from "./BuyButton.module.css";

interface BuyButtonProps {
  courseId: Id<"lmsCourses">;
  /** className from the host page so the button matches the CTA card styling. */
  className?: string;
}

/**
 * Client CTA for the "Comprar" state (signed-in learner, not yet enrolled).
 *
 * Calls the createCheckout server action (which validates the learner cookie
 * server-side, opens the MP preference, and returns the Checkout Pro URL), then
 * navigates the browser off-site to MercadoPago. On error we surface the action's
 * message inline (aria-live) without leaving the page.
 *
 * WCAG: aria-busy while loading, aria-disabled when busy, the error is an
 * aria-live="assertive" region so screen readers announce it.
 */
export function BuyButton({ courseId, className }: BuyButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    const result = await createCheckout(courseId);
    if (result.success && result.redirectUrl) {
      // Off-site navigation to MercadoPago Checkout Pro.
      window.location.assign(result.redirectUrl);
      return; // keep the spinner until the navigation commits
    }
    // "Iniciá sesión para comprar" → the learner's session lapsed; route to
    // sign-in preserving the intended course as the return target.
    if (result.error === "Iniciá sesión para comprar") {
      router.push(
        `/cursos/auth/signin?returnTo=${encodeURIComponent(window.location.pathname)}`
      );
      return;
    }
    setError(result.error ?? "No pudimos iniciar la compra.");
    setLoading(false);
  };

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={handleClick}
        disabled={loading}
        aria-busy={loading}
        aria-disabled={loading}
      >
        {loading ? "Redirigiendo…" : "Comprar"}
      </button>
      {error ? (
        <p className={styles.error} role="alert" aria-live="assertive">
          {error}
        </p>
      ) : null}
    </>
  );
}
