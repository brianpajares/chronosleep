import { setRequestLocale } from 'next-intl/server';
import { Footer } from '@/components/site/Footer';
import { Header } from '@/components/site/Header';
import { isLocale } from '@/i18n/routing';
import { notFound } from 'next/navigation';

export default async function MarketingLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  return (
    <>
      <Header variant="public" />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}
