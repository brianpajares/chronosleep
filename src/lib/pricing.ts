import monetization from '../../spec/monetizacion.json';

/**
 * Localised one-time price (spec/monetizacion.json, phase_2_payment). Prices are preliminary until
 * the elasticity test; the allow-list lives here so the client can never choose an arbitrary amount.
 */
export interface Price {
  code: string;
  country: string;
  currency: string;
  /** Major units, e.g. 7.9 */
  amount: number;
  /** Minor units (cents), e.g. 790 */
  amountMinor: number;
}

export const PRICES: readonly Price[] = monetization.phase_2_payment.prices.map((p) => ({
  code: p.code,
  country: p.country,
  currency: p.currency,
  amount: p.recommended,
  amountMinor: Math.round(p.recommended * 100),
}));

export const DEFAULT_PRICE_CODE = 'US';

export function priceFor(code: string | null | undefined): Price {
  const upper = (code ?? '').toUpperCase();
  return PRICES.find((p) => p.code === upper) ?? (PRICES.find((p) => p.code === DEFAULT_PRICE_CODE) as Price);
}

export function isPriceCountry(code: string | null | undefined): boolean {
  return PRICES.some((p) => p.code === (code ?? '').toUpperCase());
}

/** Country for pricing: explicit/geo country if we price it, otherwise a sensible default per language. */
export function defaultCountryFor(locale: 'es' | 'en' | 'pt', geoCountry?: string | null): string {
  if (isPriceCountry(geoCountry)) return (geoCountry as string).toUpperCase();
  return locale === 'pt' ? 'BR' : locale === 'es' ? 'ES' : 'US';
}

export function formatPrice(price: Price, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: price.currency }).format(price.amount);
}
