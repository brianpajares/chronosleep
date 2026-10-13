import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Processing } from '@/components/funnel/Processing';
import { isLocale } from '@/i18n/routing';
import { buildMetadata } from '@/lib/site';

export async function generateMetadata({ params }: PageProps<'/[locale]/procesando'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'processing' });
  return buildMetadata({ locale, path: '/procesando', title: t('title'), indexable: false });
}

export default async function ProcessingPage({ params }: PageProps<'/[locale]/procesando'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  return <Processing />;
}
