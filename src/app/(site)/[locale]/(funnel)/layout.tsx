import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Footer } from '@/components/site/Footer';
import { Header } from '@/components/site/Header';
import { isLocale } from '@/i18n/routing';
import { pickMessages } from '@/messages';
import { FUNNEL_NAMESPACES } from '@/messages/namespaces';

/** Funnel shell: reduced header (logo + language + help) and the client catalogs the funnel needs. */
export default async function FunnelLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  return (
    <NextIntlClientProvider locale={locale} messages={pickMessages(locale, FUNNEL_NAMESPACES)}>
      <Header variant="funnel" />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </NextIntlClientProvider>
  );
}
