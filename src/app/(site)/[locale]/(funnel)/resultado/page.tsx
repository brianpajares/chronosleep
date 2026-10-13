import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ResultView } from '@/components/funnel/ResultView';
import { isLocale } from '@/i18n/routing';
import { buildMetadata } from '@/lib/site';

export async function generateMetadata({ params }: PageProps<'/[locale]/resultado'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'preview' });
  return buildMetadata({ locale, path: '/resultado', title: t('title'), indexable: false });
}

export default async function ResultPage({ params }: PageProps<'/[locale]/resultado'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  return <ResultView />;
}
