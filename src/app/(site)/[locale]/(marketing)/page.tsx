import { ArrowRight, BookOpenCheck, CalendarRange, Check, ChevronDown, Clock3 } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { HeroVisual } from '@/components/marketing/HeroVisual';
import { JsonLd } from '@/components/marketing/JsonLd';
import { LandingViewTracker } from '@/components/marketing/LandingViewTracker';
import { TrackedCta } from '@/components/marketing/TrackedCta';
import { Card, Eyebrow } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { isLocale } from '@/i18n/routing';
import { absoluteUrl, buildMetadata } from '@/lib/site';

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'meta' });
  return buildMetadata({
    locale,
    path: '/',
    title: t('landing_title'),
    description: t('landing_description'),
    indexable: true,
    absoluteTitle: true,
  });
}

const CARD_ICONS = [Clock3, CalendarRange, BookOpenCheck] as const;

export default async function LandingPage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('landing');
  const cards = t.raw('cards') as { title: string; body: string }[];
  const steps = t.raw('steps') as { title: string; body: string }[];
  const trust = t.raw('trust_items') as string[];
  const faq = t.raw('faq_items') as { q: string; a: string }[];

  return (
    <>
      <LandingViewTracker />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'ChronoSleep',
          url: absoluteUrl(locale, '/'),
          applicationCategory: 'HealthApplication',
          operatingSystem: 'Any',
          inLanguage: locale,
          description: t('schema_description'),
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        }}
      />

      {/* Hero */}
      <section className="hero-glow">
        <div className="container-page grid gap-12 py-14 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-24">
          <div className="animate-rise">
            <Eyebrow>{t('eyebrow')}</Eyebrow>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-fg sm:text-5xl">{t('title')}</h1>
            <p className="mt-5 max-w-xl text-lg text-muted">{t('subtitle')}</p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
              <TrackedCta source="landing_hero">
                {t('cta')}
                <ArrowRight aria-hidden="true" className="size-5" />
              </TrackedCta>
              <p className="text-sm text-muted">{t('trust')}</p>
            </div>
            <p className="mt-6 max-w-xl text-xs text-muted">{t('disclaimer')}</p>
          </div>
          <div className="animate-rise [animation-delay:120ms]">
            <HeroVisual locale={locale} />
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="container-page py-16" aria-labelledby="what-title">
        <div className="max-w-2xl">
          <h2 id="what-title" className="text-3xl font-bold">
            {t('what_title')}
          </h2>
          <p className="mt-3 text-lg text-muted">{t('what_subtitle')}</p>
        </div>
        <ul className="mt-10 grid gap-5 md:grid-cols-3">
          {cards.map((c, i) => {
            const Icon = CARD_ICONS[i] ?? Clock3;
            return (
              <li key={c.title}>
                <Card className="h-full p-6 transition-shadow hover:shadow-md">
                  <span className="inline-flex size-12 items-center justify-center rounded-md bg-primary-soft text-primary">
                    <Icon aria-hidden="true" className="size-6 text-fg" />
                  </span>
                  <h3 className="mt-5 text-xl font-semibold">{c.title}</h3>
                  <p className="mt-2 text-muted">{c.body}</p>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Steps */}
      <section className="py-4" aria-labelledby="steps-title">
        <div className="container-page rounded-xl border border-line bg-surface px-6 py-12 shadow-sm md:px-12">
          <h2 id="steps-title" className="text-3xl font-bold">
            {t('steps_title')}
          </h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="relative flex gap-4">
                <span
                  aria-hidden="true"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-on-primary"
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-lg font-semibold">{s.title}</h3>
                  <p className="mt-1 text-muted">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Trust */}
      <section className="container-page py-16" aria-labelledby="trust-title">
        <h2 id="trust-title" className="text-3xl font-bold">
          {t('trust_title')}
        </h2>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {trust.map((item) => (
            <li
              key={item}
              className="flex items-center gap-3 rounded-md border border-line bg-surface px-4 py-3 font-semibold"
            >
              <Check aria-hidden="true" className="size-5 shrink-0 text-success" />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-5 max-w-3xl text-sm text-muted">{t('trust_mctq')}</p>
      </section>

      {/* Mini FAQ */}
      <section className="container-page pb-6" aria-labelledby="faq-title">
        <h2 id="faq-title" className="text-3xl font-bold">
          {t('faq_title')}
        </h2>
        <div className="mt-6 max-w-3xl divide-y divide-line rounded-lg border border-line bg-surface">
          {faq.map((f) => (
            <details key={f.q} className="group px-5 py-1">
              <summary className="flex min-h-12 list-none items-center justify-between gap-4 py-2 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown
                  aria-hidden="true"
                  className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="pb-4 text-muted">{f.a}</p>
            </details>
          ))}
        </div>
        <Link href="/faq" className="mt-4 inline-flex min-h-11 items-center font-semibold">
          {t('faq_more')}
        </Link>
      </section>

      {/* Final CTA */}
      <section className="container-page py-16">
        <div className="hero-glow rounded-xl border border-line bg-surface px-6 py-12 text-center shadow-md md:px-12">
          <h2 className="mx-auto max-w-2xl text-3xl font-bold">{t('final_title')}</h2>
          <p className="mx-auto mt-3 max-w-xl text-lg text-muted">{t('final_body')}</p>
          <div className="mt-8 flex justify-center">
            <TrackedCta source="landing_footer">
              {t('cta')}
              <ArrowRight aria-hidden="true" className="size-5" />
            </TrackedCta>
          </div>
        </div>
      </section>
    </>
  );
}
