import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { LandingViewTracker } from '@/components/marketing/LandingViewTracker';
import { TrackedCta } from '@/components/marketing/TrackedCta';
import { Eyebrow } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { isLocale, LOCALES } from '@/i18n/routing';
import { buildMetadata } from '@/lib/site';
import { CASE_KEYS, CASE_SLUGS, caseKeyFromSlug, COUNTRY_LOCALES, isCountryFor } from '@/lib/seo-routes';

export const dynamicParams = false;
export function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    COUNTRY_LOCALES[locale].flatMap((country) => CASE_KEYS.map((k) => ({ locale, country, useCase: CASE_SLUGS[locale][k] }))),
  );
}

export async function generateMetadata({ params }: PageProps<'/[locale]/[country]/casos/[useCase]'>): Promise<Metadata> {
  const { locale, country, useCase } = await params;
  if (!isLocale(locale) || !isCountryFor(locale, country)) return {};
  const key = caseKeyFromSlug(locale, useCase);
  if (!key) return {};
  const t = await getTranslations({ locale });
  return buildMetadata({
    locale,
    path: `/${country}/casos/${useCase}`,
    title: t('meta.case_title', { useCase: t(`cases.${key}.name`), country: t(`countries.${country}.name`) }),
    description: t(`cases.${key}.intro`),
    indexable: true,
    available: [locale],
  });
}

export default async function CasePage({ params }: PageProps<'/[locale]/[country]/casos/[useCase]'>) {
  const { locale, country, useCase } = await params;
  if (!isLocale(locale) || !isCountryFor(locale, country)) notFound();
  const key = caseKeyFromSlug(locale, useCase);
  if (!key) notFound();
  setRequestLocale(locale);
  const t = await getTranslations();
  const points = t.raw(`cases.${key}.points`) as string[];

  return (
    <div className="container-report py-12 sm:py-16">
      <LandingViewTracker countryCode={country.toUpperCase()} />
      <Eyebrow>{t(`countries.${country}.name`)}</Eyebrow>
      <h1 className="mt-2 text-4xl font-extrabold tracking-tight">{t(`cases.${key}.h1`)}</h1>
      <p className="mt-4 text-lg text-muted">{t(`cases.${key}.intro`)}</p>
      <ul className="mt-8 list-disc space-y-2 pl-5">
        {points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <div className="mt-10 flex flex-wrap items-center gap-5">
        <TrackedCta source={`case_${key}`}>{t('country.cta')}</TrackedCta>
        <Link href={`/${country}/social-jetlag`} className="inline-flex min-h-11 items-center font-semibold">
          {t('meta.country_title', { country: t(`countries.${country}.name`) })}
        </Link>
      </div>
      <p className="mt-8 text-xs text-muted">{t('landing.disclaimer')}</p>
    </div>
  );
}
