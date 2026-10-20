import type { Metadata } from 'next';
import { LOCALES, routing, type AppLocale } from '@/i18n/routing';

/** Public origin used for canonical URLs, sitemap and emails (no trailing slash). */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit && !explicit.includes('localhost')) return explicit.replace(/\/$/, '');
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`.replace(/\/$/, '');
  return (explicit ?? 'http://localhost:3000').replace(/\/$/, '');
}

/**
 * Indexing is OFF until the launch gate (brand clearance, legal texts, deliverability) is closed.
 * Flip with NEXT_PUBLIC_INDEXING_ENABLED=true — see docs/LAUNCH_CHECKLIST.md.
 */
export function indexingEnabled(): boolean {
  return process.env.NEXT_PUBLIC_INDEXING_ENABLED === 'true';
}

export function legalEntity(): string {
  return process.env.NEXT_PUBLIC_LEGAL_ENTITY ?? 'ChronoSleep (entidad operadora por confirmar)';
}

export function legalRuc(): string | undefined {
  return process.env.NEXT_PUBLIC_LEGAL_RUC || undefined;
}

export function legalAddress(): string | undefined {
  return process.env.NEXT_PUBLIC_LEGAL_ADDRESS || undefined;
}

export function supportEmail(): string {
  return process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? process.env.NEXT_PUBLIC_PRIVACY_EMAIL ?? 'support@chronosleep.app';
}

export function privacyContact(): string {
  return process.env.NEXT_PUBLIC_PRIVACY_EMAIL ?? process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'privacy@chronosleep.app';
}

/** Path with the as-needed locale prefix (default locale has none). */
export function localizedPath(locale: AppLocale, path: string): string {
  const clean = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  if (locale === routing.defaultLocale) return clean || '/';
  return `/${locale}${clean}`;
}

export function absoluteUrl(locale: AppLocale, path: string): string {
  return `${siteUrl()}${localizedPath(locale, path)}`;
}

export function alternatesFor(
  locale: AppLocale,
  path: string,
  available: readonly AppLocale[] = LOCALES,
): NonNullable<Metadata['alternates']> {
  const languages: Record<string, string> = {};
  for (const l of available) languages[l] = absoluteUrl(l, path);
  languages['x-default'] = absoluteUrl(routing.defaultLocale, path);
  return { canonical: absoluteUrl(locale, path), languages };
}

export function robotsFor(indexable: boolean): Metadata['robots'] {
  if (indexable && indexingEnabled()) return { index: true, follow: true };
  return { index: false, follow: false, nocache: true };
}

const OG_LOCALE: Record<AppLocale, string> = { es: 'es_ES', en: 'en_US', pt: 'pt_BR' };

export interface PageMetaInput {
  locale: AppLocale;
  path: string;
  title: string;
  description?: string;
  indexable?: boolean;
  /** Locales that have an equivalent page (hreflang). Defaults to all. */
  available?: readonly AppLocale[];
  absoluteTitle?: boolean;
}

export function buildMetadata({
  locale,
  path,
  title,
  description,
  indexable = false,
  available,
  absoluteTitle = false,
}: PageMetaInput): Metadata {
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: indexable ? alternatesFor(locale, path, available) : undefined,
    robots: robotsFor(indexable),
    openGraph: {
      type: 'website',
      siteName: 'ChronoSleep',
      title,
      description,
      url: absoluteUrl(locale, path),
      locale: OG_LOCALE[locale],
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}
