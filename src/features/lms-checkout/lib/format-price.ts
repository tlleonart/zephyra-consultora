/**
 * Format a USD price for the catalog. Orders are ALWAYS priced in USD (SDD
 * §9.4); MercadoPago converts to ARS at checkout. We render the canonical USD
 * list price with the es-AR locale (the site's audience) so grouping/decimals
 * read naturally, e.g. 90 -> "US$ 90", 1499.5 -> "US$ 1.499,50".
 */
export function formatUsd(priceUsd: number): string {
  const formatted = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: Number.isInteger(priceUsd) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(priceUsd);
  return `US$ ${formatted}`;
}
