import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CheckoutView } from '@/components/funnel/CheckoutView';
import { isLocale } from '@/i18n/routing';
import { defaultCountryFor, PRICES } from '@/lib/pricing';
import { buildMetadata } from '@/lib/site';
import { env } from '@/server/env';

export async function generateMetadata({ params }: PageProps<'/[locale]/checkout'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'checkout' });
  return buildMetadata({ locale, path: '/checkout', title: t('title'), indexable: false });
}

/** Phase 2 only. In validation mode the route does not exist (404) — FR-24. */
export default async function CheckoutPage({ params, searchParams }: PageProps<'/[locale]/checkout'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  if (env.monetizationMode() !== 'stripe') notFound();
  setRequestLocale(locale);

  const sp = await searchParams;
  const geo = (await headers()).get('x-vercel-ip-country');
  const lead = typeof sp.lead === 'string' && /^[0-9a-f-]{36}$/i.test(sp.lead) ? sp.lead : undefined;
  return (
    <CheckoutView
      prices={[...PRICES]}
      defaultCountry={defaultCountryFor(locale, geo)}
      leadParam={lead}
      cancelled={sp.cancelled === '1'}
    />
  );
}
