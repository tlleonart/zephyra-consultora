'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from 'convex/react';
import { api } from '@zephyra/convex/_generated/api';
import type { Id } from '@zephyra/convex/_generated/dataModel';
import { formatUsd } from '@/features/lms-checkout/lib/format-price';
import { institutionalHref } from '@/lib/institutional-links';
import { createPackCheckout } from '../../actions/create-pack-checkout';
import { btnClass } from '@zephyra/ui';
import styles from './PackCalculator.module.css';

interface Band {
  label: string;
  discountLabel: string;
  /** min seat for highlight matching */
  min: number;
  /** max seat (null = open band) */
  max: number | null;
  contact: boolean;
}

// Display-only band reference so the buyer understands volume pricing. The
// SERVER is the pricing authority — this table is purely educational; the
// actual applied discount + total always come from computePackPrice.
const BANDS: Band[] = [
  { label: '1–9 lugares', discountLabel: 'Sin descuento', min: 1, max: 9, contact: false },
  { label: '10–24 lugares', discountLabel: '10% off', min: 10, max: 24, contact: false },
  { label: '25–49 lugares', discountLabel: '20% off', min: 25, max: 49, contact: false },
  { label: '50 o más', discountLabel: 'Precio a medida', min: 50, max: null, contact: true },
];

const bandIndexForSeats = (seats: number): number =>
  BANDS.findIndex((b) => seats >= b.min && (b.max === null || seats <= b.max));

interface PackCalculatorProps {
  courseId: Id<'lmsCourses'>;
  courseTitle: string;
  organizationId: Id<'lmsOrganizations'>;
}

/**
 * E2 + E3 — live volume-discount calculator + pack checkout (api-contract §2/§3).
 *
 * DISPLAY-ONLY PRICING: the seat count is the ONLY thing the client computes.
 * It reactively calls computePackPrice(courseId, seatCount); the per-seat price,
 * applied discount %, and total all come FROM the server response and are only
 * rendered. The client never computes or sends a price — checkout receives only
 * seatCount and the server recomputes.
 *
 * The 50+ band returns selfCheckoutAllowed:false ⇒ we render the "Contactanos"
 * CTA, NOT a checkout button (the checkout action also rejects that band).
 *
 * WCAG: labelled numeric seat input, the live quote region is aria-live so a
 * screen reader announces price updates, the bands table has scope'd headers
 * and a caption, and the active band is conveyed in text (not color alone).
 */
export function PackCalculator({
  courseId,
  courseTitle,
  organizationId,
}: PackCalculatorProps) {
  const router = useRouter();
  const seatInputId = useId();
  const [seatInput, setSeatInput] = useState('5');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const seatCount = Number.parseInt(seatInput, 10);
  const validSeats = Number.isInteger(seatCount) && seatCount >= 1;

  // Reactive server quote. Skip when the seat count is not a usable integer so
  // we don't fire a query that the server would reject as seat_count_invalid.
  const quote = useQuery(
    api.lms.packs.computePackPrice,
    validSeats ? { courseId, seatCount } : 'skip'
  );

  const activeBandIndex = validSeats ? bandIndexForSeats(seatCount) : -1;

  const handleBuy = async () => {
    setCheckoutLoading(true);
    setCheckoutError(null);
    // Send ONLY seatCount — no price/discount/total. The server recomputes.
    const result = await createPackCheckout({
      organizationId,
      courseId,
      seatCount,
    });
    if (result.success && result.redirectUrl) {
      window.location.assign(result.redirectUrl);
      return; // keep the spinner until the off-site navigation commits
    }
    if (result.error === 'Iniciá sesión para comprar') {
      router.push('/cursos/auth/signin?returnTo=/empresa/cursos');
      return;
    }
    setCheckoutError(result.error ?? 'No pudimos iniciar la compra.');
    setCheckoutLoading(false);
  };

  const isAvailable = quote && quote.available === true;
  const canCheckout = isAvailable && quote.selfCheckoutAllowed === true;
  const needsContact = isAvailable && quote.selfCheckoutAllowed === false;

  return (
    <div>
      <Link href="/empresa/cursos" className={styles.backLink}>
        ← Volver al catálogo
      </Link>
      <h1 className={styles.title}>{courseTitle}</h1>
      <p className={styles.lead}>
        Comprá lugares para tu equipo. Ingresá cuántas personas van a hacer el
        curso y calculamos el precio con el descuento por volumen que
        corresponda. El precio lo determina Zephyra al momento de la compra.
      </p>

      <div className={styles.layout}>
        <div>
          <h2 className={styles.bandsTitle}>Descuentos por volumen</h2>
          <table className={styles.bands}>
            <caption>
              El descuento aplica automáticamente según la cantidad de lugares.
            </caption>
            <thead>
              <tr>
                <th scope="col">Lugares</th>
                <th scope="col">Descuento</th>
              </tr>
            </thead>
            <tbody>
              {BANDS.map((b, i) => (
                <tr
                  key={b.label}
                  className={i === activeBandIndex ? styles.bandActive : undefined}
                  aria-current={i === activeBandIndex ? 'true' : undefined}
                >
                  <td>{b.label}</td>
                  <td>{b.discountLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.panel}>
          <div className={styles.seatField}>
            <label htmlFor={seatInputId} className={styles.seatLabel}>
              Cantidad de lugares
            </label>
            <input
              id={seatInputId}
              className={styles.seatInput}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={seatInput}
              onChange={(e) => setSeatInput(e.target.value)}
              aria-describedby={`${seatInputId}-quote`}
            />
          </div>

          <div id={`${seatInputId}-quote`} aria-live="polite">
            {!validSeats ? (
              <p className={styles.note}>
                Ingresá una cantidad de lugares (1 o más) para ver el precio.
              </p>
            ) : quote === undefined ? (
              <p className={styles.loading}>Calculando precio…</p>
            ) : quote.available === false ? (
              <p className={styles.unavailable}>
                Este curso no está disponible para compra por equipos en este
                momento.
              </p>
            ) : (
              <>
                <div className={styles.summary}>
                  <div className={styles.summaryRow}>
                    <span>Precio por lugar (lista)</span>
                    <span className={styles.summaryValue}>
                      {formatUsd(quote.unitPriceUsd)}
                    </span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Lugares</span>
                    <span className={styles.summaryValue}>{quote.seatCount}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Descuento por volumen</span>
                    <span
                      className={
                        quote.appliedDiscountPct > 0
                          ? styles.discountValue
                          : styles.summaryValue
                      }
                    >
                      {quote.appliedDiscountPct > 0
                        ? `−${quote.appliedDiscountPct}%`
                        : 'Sin descuento'}
                    </span>
                  </div>
                </div>

                {needsContact ? (
                  <div className={styles.contact}>
                    <p className={styles.contactText}>
                      Para 50 lugares o más armamos una propuesta a medida.
                      Escribinos y coordinamos el precio para tu equipo.
                    </p>
                    {/* Was href="/contacto", dead on this host. This is the
                        50+-seat B2B enquiry CTA — a commercial dead end, not a
                        cosmetic one: the buyer who reads "escribinos" and clicks
                        landed on a 404. /contacto is served by www. */}
                    <Link
                      href={institutionalHref('/contacto')}
                      className={btnClass({ size: 'sm' })}
                    >
                      Contactanos
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className={styles.totalRow}>
                      <span className={styles.totalLabel}>Total</span>
                      <span className={styles.totalValue}>
                        {formatUsd(quote.totalPriceUsd)}
                      </span>
                    </div>
                    <p className={styles.note}>
                      Precio en USD. El cargo se procesa en pesos al tipo de
                      cambio de MercadoPago al momento del pago.
                    </p>
                    <button
                      type="button"
                      className={btnClass({ size: 'lg', block: true })}
                      onClick={handleBuy}
                      disabled={checkoutLoading || !canCheckout}
                      aria-busy={checkoutLoading}
                    >
                      {checkoutLoading
                        ? 'Redirigiendo…'
                        : 'Comprar para mi equipo'}
                    </button>
                    {checkoutError ? (
                      <p
                        className={styles.error}
                        role="alert"
                        aria-live="assertive"
                      >
                        {checkoutError}
                      </p>
                    ) : null}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
