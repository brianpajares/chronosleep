import type { AppLocale } from '@/i18n/routing';

/** Country landing pages (ux/sitemap_flows.md §7): only the combinations the spec lists. */
export const COUNTRY_LOCALES: Record<AppLocale, readonly string[]> = {
  es: ['mx', 'es'],
  pt: ['br'],
  en: ['us', 'gb', 'ca', 'au'],
};

export const CASE_KEYS = ['hybrid', 'students', 'weekend', 'schedule'] as const;
export type CaseKey = (typeof CASE_KEYS)[number];

/** Localised use-case slugs (must match messages `cases.<key>.slug`). */
export const CASE_SLUGS: Record<AppLocale, Record<CaseKey, string>> = {
  es: { hybrid: 'trabajo-hibrido', students: 'estudiantes-adultos', weekend: 'cambio-de-sueno-fin-de-semana', schedule: 'cambio-de-horario-laboral' },
  en: { hybrid: 'hybrid-work', students: 'adult-students', weekend: 'weekend-sleep-shift', schedule: 'work-schedule-change' },
  pt: { hybrid: 'trabalho-hibrido', students: 'estudantes-adultos', weekend: 'mudanca-de-horario-fim-de-semana', schedule: 'mudanca-de-horario-de-trabalho' },
};

export function caseKeyFromSlug(locale: AppLocale, slug: string): CaseKey | null {
  const entry = (Object.entries(CASE_SLUGS[locale]) as [CaseKey, string][]).find(([, s]) => s === slug);
  return entry ? entry[0] : null;
}

export function isCountryFor(locale: AppLocale, country: string): boolean {
  return COUNTRY_LOCALES[locale].includes(country);
}

/** Every indexable public path (without locale prefix) for the sitemap. */
export function publicPaths(locale: AppLocale): string[] {
  const paths = ['/', '/como-funciona', '/faq', '/legal/privacidad', '/legal/terminos', '/legal/salud', '/legal/derechos', '/legal/reembolsos', '/legal/cookies', '/legal/libro-de-reclamaciones', '/legal/creditos'];
  for (const c of COUNTRY_LOCALES[locale]) {
    paths.push(`/${c}/social-jetlag`);
    for (const k of CASE_KEYS) paths.push(`/${c}/casos/${CASE_SLUGS[locale][k]}`);
  }
  return paths;
}
