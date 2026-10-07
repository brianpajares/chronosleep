import { defineRouting } from 'next-intl/routing';

export const LOCALES = ['es', 'en', 'pt'] as const;
export type AppLocale = (typeof LOCALES)[number];

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: 'es',
  // `/` and `/es` resolve to the default locale; en/pt keep their prefix.
  localePrefix: 'as-needed',
  // hreflang/canonical are emitted through the Metadata API per page.
  alternateLinks: false,
});

export function isLocale(value: string | undefined | null): value is AppLocale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
