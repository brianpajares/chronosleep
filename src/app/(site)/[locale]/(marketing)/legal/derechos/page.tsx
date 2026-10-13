import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { RightsForm } from '@/components/marketing/RightsForm';
import { Eyebrow } from '@/components/ui/primitives';
import { isLocale } from '@/i18n/routing';
import { buildMetadata } from '@/lib/site';
import { pickMessages } from '@/messages';
import { BASE_CLIENT_NAMESPACES } from '@/messages/namespaces';

export async function generateMetadata({ params }: PageProps<'/[locale]/legal/derechos'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'meta' });
  return buildMetadata({ locale, path: '/legal/derechos', title: t('rights_title'), indexable: true });
}

export default async function RightsPage({ params }: PageProps<'/[locale]/legal/derechos'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('rights');
  return (
    <div className="container-form py-12 sm:py-16">
      <Eyebrow>{t('eyebrow')}</Eyebrow>
      <h1 className="mt-2 text-4xl font-extrabold tracking-tight">{t('title')}</h1>
      <p className="mt-4 mb-8 text-lg text-muted">{t('intro')}</p>
      <NextIntlClientProvider locale={locale} messages={pickMessages(locale, [...BASE_CLIENT_NAMESPACES, 'rights', 'gate'])}>
        <RightsForm />
      </NextIntlClientProvider>
    </div>
  );
}
