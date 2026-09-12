/**
 * Las bandas de descuento por volumen, en UN solo lugar.
 *
 * POR QUE SALEN DE ACA Y NO DE CADA PANTALLA. Estas bandas se pintan en dos
 * superficies muy distintas: la calculadora de la duena de empresa
 * (PackCalculator, detras del gate de duena) y la propuesta publica de
 * /empresa, que ve cualquiera. Son el mismo hecho comercial contado dos veces.
 * Si cada pantalla escribiera su tabla, la publica podria quedar prometiendo un
 * descuento que la calculadora ya no aplica — y el que se entera es el que
 * compra. Una lista, dos renderizados.
 *
 * ESTO ES SOLO LA VISTA. El precio lo calcula el servidor y nadie mas:
 * `computePackPrice` lee `lmsVolumeDiscountTiers` y devuelve unitario,
 * descuento aplicado y total. El cliente nunca manda un precio ni un descuento
 * (anti-tamper #5, SDD Sprint 3 §7). Esta tabla es material explicativo: sirve
 * para que se entienda la escala antes de pedir la cotizacion, no para
 * cotizar.
 *
 * SI CAMBIAN LAS BANDAS: se cambian en la config de Convex
 * (`lmsVolumeDiscountTiers`, sembrada por `seedVolumeDiscountTiers`) Y aca. No
 * hay query publica que las liste, asi que este archivo es el espejo — y el
 * comentario existe para que quien toque una se acuerde de la otra.
 */
export interface VolumeBand {
  label: string;
  discountLabel: string;
  /** Piso de la banda, para resaltar la que aplica. */
  min: number;
  /** Techo de la banda; null = banda abierta. */
  max: number | null;
  /** true ⇒ no hay autoservicio: se responde con una propuesta a medida. */
  contact: boolean;
}

export const VOLUME_BANDS: VolumeBand[] = [
  { label: '1–9 lugares', discountLabel: 'Sin descuento', min: 1, max: 9, contact: false },
  { label: '10–24 lugares', discountLabel: '10% off', min: 10, max: 24, contact: false },
  { label: '25–49 lugares', discountLabel: '20% off', min: 25, max: 49, contact: false },
  { label: '50 o más', discountLabel: 'Precio a medida', min: 50, max: null, contact: true },
];

/** Indice de la banda que contiene `seats`, o -1 si ninguna. */
export const bandIndexForSeats = (seats: number): number =>
  VOLUME_BANDS.findIndex((b) => seats >= b.min && (b.max === null || seats <= b.max));
