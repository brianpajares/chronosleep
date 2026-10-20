'use client';

/**
 * Google Analytics 4 — consent-gated, PII-free, single entry point (see ANALYTICS.md).
 * The script is injected only AFTER the visitor grants analytics consent; ads storage and
 * personalisation stay denied permanently (the app runs no advertising).
 */

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

type GtagFn = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GtagFn;
  }
}

export function gaConfigured(): boolean {
  return Boolean(GA_ID && /^G-[A-Z0-9]{6,}$/.test(GA_ID));
}

let loaded = false;

export function loadGa(): void {
  if (loaded || !gaConfigured() || typeof window === 'undefined') return;
  loaded = true;
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag(...args: unknown[]) {
    (window.dataLayer as unknown[]).push(args);
  };
  // Consent Mode v2: defaults are denied; only analytics storage is granted, and only now.
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
  });
  window.gtag('consent', 'update', { analytics_storage: 'granted' });
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, {
    send_page_view: false, // manual, so SPA navigations are counted once and URLs are sanitised
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID as string)}`;
  document.head.appendChild(s);
}

/** Turns analytics storage off again if the visitor withdraws consent. */
export function revokeGa(): void {
  if (window.gtag) window.gtag('consent', 'update', { analytics_storage: 'denied' });
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Path only: no query/hash (report tokens!), ids replaced. */
export function sanitizePath(pathname: string): string {
  return pathname.split('?')[0]!.split('#')[0]!.replace(UUID_RE, ':id');
}

export function gaPageView(pathname: string, title?: string): void {
  if (!window.gtag || !gaConfigured()) return;
  window.gtag('event', 'page_view', {
    page_path: sanitizePath(pathname),
    page_location: `${window.location.origin}${sanitizePath(pathname)}`,
    page_title: title,
  });
}

const ITEM = {
  item_id: 'chronosleep_full_report',
  item_name: 'ChronoSleep full report',
  item_category: 'report',
  quantity: 1,
};

type Props = Record<string, string | number | boolean>;

/**
 * Maps our privacy-reviewed event catalog onto GA4 recommended e-commerce events where one fits,
 * and to snake_case custom events otherwise. Input props were already sanitised by the catalog.
 */
export function mapToGa(event: string, props: Props): [string, Record<string, unknown>] | null {
  const priceMinor = typeof props.price_minor === 'number' ? props.price_minor : undefined;
  const money = priceMinor !== undefined ? { currency: String(props.currency ?? 'USD'), value: priceMinor / 100 } : {};
  const items = [{ ...ITEM, price: priceMinor !== undefined ? priceMinor / 100 : 0 }];
  switch (event) {
    case 'landing_view':
      return null; // page_view covers it
    case 'calculator_start':
      return ['cta_click', { cta_location: props.source_page, destination: 'calculator' }];
    case 'preview_view':
      return ['view_item', { items, sjl_band: props.sjl_band, direction: props.direction }];
    case 'preview_report_cta':
      return ['add_to_cart', { items, currency: 'USD', value: 0 }];
    case 'report_gate_view':
      return ['view_cart', { items, currency: 'USD', value: 0 }];
    case 'email_submitted':
      return ['generate_lead', { currency: 'USD', value: 0, lead_phase: props.phase }];
    case 'checkout_view':
      return ['view_item_list', { item_list_name: 'checkout', items, ...money }];
    case 'checkout_started':
      return ['begin_checkout', { items, ...money }];
    case 'payment_failed':
      return ['payment_failed', { reason_code: props.error_category, payment_type: props.payment_provider }];
    case 'validation_error':
      return ['checkout_error', { step: props.step, error_type: props.error_code }];
    default:
      return [event, { ...props }];
  }
}

export function gaEvent(event: string, props: Props): void {
  if (!window.gtag || !gaConfigured()) return;
  const mapped = mapToGa(event, props);
  if (mapped) window.gtag('event', mapped[0], mapped[1]);
}

/** `_ga` cookie → GA client id ("GA1.1.123.456" → "123.456"); only read after consent. */
export function readGaClientId(): string | undefined {
  const m = document.cookie.match(/(?:^|;\s*)_ga=GA\d\.\d\.(\d+\.\d+)/);
  return m?.[1];
}
