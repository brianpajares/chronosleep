import { ChevronDown } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/marketing/JsonLd';
import { TrackedCta } from '@/components/marketing/TrackedCta';
import { Eyebrow } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { isLocale } from '@/i18n/routing';
import { buildMetadata } from '@/lib/site';

export async function generateMetadata({ params }: PageProps<'/[locale]/faq'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'meta' });
  return buildMetadata({ locale, path: '/faq', title: t('faq_title'), description: t('faq_description'), indexable: true });
}

export default async function FaqPage({ params }: PageProps<'/[locale]/faq'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('faq');
  const nav = await getTranslations('nav');
  const items = t.raw('items') as { q: string; a: string }[];

  return (
    <div className="container-report py-12 sm:py-16">
      {/* FAQPage only here: the same Q&A is fully visible on this page. */}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          name: t('schema_name'),
          inLanguage: locale,
          mainEntity: items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
        }}
      />
      <Eyebrow>{t('eyebrow')}</Eyebrow>
      <h1 className="mt-2 text-4xl font-extrabold tracking-tight">{t('title')}</h1>
      <div className="mt-8 divide-y divide-line rounded-lg border border-line bg-surface">
        {items.map((f) => (
          <details key={f.q} className="group px-5 py-1">
            <summary className="flex min-h-12 list-none items-center justify-between gap-4 py-2 text-lg font-semibold [&::-webkit-details-marker]:hidden">
              {f.q}
              <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <p className="pb-4 text-muted">{f.a}</p>
          </details>
        ))}
      </div>
      <section className="mt-12 text-center">
        <h2 className="text-2xl font-bold">{t('still_title')}</h2>
        <p className="mx-auto mt-2 max-w-md text-muted">{t('still_body')}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          <TrackedCta source="faq">{nav('calculate')}</TrackedCta>
          <Link href="/como-funciona" className="inline-flex min-h-11 items-center font-semibold">
            {nav('how')}
          </Link>
        </div>
      </section>
    </div>
  );
}
