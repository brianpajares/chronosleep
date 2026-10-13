import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { LandingViewTracker } from '@/components/marketing/LandingViewTracker';
import { TrackedCta } from '@/components/marketing/TrackedCta';
import { Card, Eyebrow } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { isLocale, LOCALES } from '@/i18n/routing';
import { buildMetadata } from '@/lib/site';
import { CASE_KEYS, COUNTRY_LOCALES, isCountryFor } from '@/lib/seo-routes';

export const dynamicParams = false;
export function generateStaticParams() {
  return LOCALES.flatMap((locale) => COUNTRY_LOCALES[locale].map((country) => ({ locale, country })));
}

export async function generateMetadata({ params }: PageProps<'/[locale]/[country]/social-jetlag'>): Promise<Metadata> {
  const { locale, country } = await params;
  if (!isLocale(locale) || !isCountryFor(locale, country)) return {};
  const t = await getTranslations({ locale });
  const name = t(`countries.${country}.name`);
  return buildMetadata({
    locale,
    path: `/${country}/social-jetlag`,
    title: t('meta.country_title', { country: name }),
    description: t('meta.country_description', { country: name }),
    indexable: true,
    available: [locale],
  });
}

export default async function CountryPage({ params }: PageProps<'/[locale]/[country]/social-jetlag'>) {
  const { locale, country } = await params;
  if (!isLocale(locale) || !isCountryFor(locale, country)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations();
  const name = t(`countries.${country}.name`);
  const points = t.raw('country.points') as string[];

  return (
    <div className="container-report py-12 sm:py-16">
      <LandingViewTracker countryCode={country.toUpperCase()} />
      <Eyebrow>{t('country.eyebrow')}</Eyebrow>
      <h1 className="mt-2 text-4xl font-extrabold tracking-tight">{t('country.h1', { country: name })}</h1>
      <p className="mt-4 text-lg text-muted">{t('country.intro', { country: name })}</p>
      <div className="mt-8">
        <TrackedCta source={`country_${country}`}>{t('country.cta')}</TrackedCta>
      </div>

      <Card className="mt-10 p-6">
        <h2 className="text-lg font-semibold">{t('country.example_title')}</h2>
        <p className="mt-2 text-muted">{t(`countries.${country}.example`)}</p>
      </Card>

      <section className="mt-10 space-y-3">
        <h2 className="text-2xl font-bold">{t('country.points_title')}</h2>
        <ul className="list-disc space-y-1 pl-5">
          {points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="text-sm text-muted">{t('country.note')}</p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-2xl font-bold">{t('country.cases_title')}</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {CASE_KEYS.map((k) => (
            <li key={k}>
              <Link
                href={`/${country}/casos/${t(`cases.${k}.slug`)}`}
                className="flex min-h-14 items-center rounded-md border border-line bg-surface px-4 font-semibold no-underline hover:bg-subtle"
              >
                {t(`cases.${k}.name`)}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
