import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { WizardStep } from '@/components/funnel/WizardStep';
import { isLocale } from '@/i18n/routing';
import { buildMetadata } from '@/lib/site';

export const dynamicParams = false;

export function generateStaticParams() {
  return Array.from({ length: 8 }, (_, i) => ({ step: String(i + 1) }));
}

export async function generateMetadata({ params }: PageProps<'/[locale]/calcular/[step]'>): Promise<Metadata> {
  const { locale, step } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale });
  return buildMetadata({
    locale,
    path: `/calcular/${step}`,
    title: t('progress', { current: Number(step), total: 8 }),
    indexable: false,
  });
}

export default async function WizardPage({ params }: PageProps<'/[locale]/calcular/[step]'>) {
  const { locale, step } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const n = Number(step);
  if (!Number.isInteger(n) || n < 1 || n > 8) notFound();
  return <WizardStep step={n} />;
}
