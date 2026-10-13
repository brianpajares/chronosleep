import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ReportGate } from '@/components/funnel/ReportGate';
import { isLocale } from '@/i18n/routing';
import { buildMetadata } from '@/lib/site';

export async function generateMetadata({ params }: PageProps<'/[locale]/informe/solicitar'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'gate' });
  return buildMetadata({ locale, path: '/informe/solicitar', title: t('title'), indexable: false });
}

export default async function GatePage({ params }: PageProps<'/[locale]/informe/solicitar'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  return <ReportGate />;
}
