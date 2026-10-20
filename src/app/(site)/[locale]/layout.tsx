import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ConsentBanner } from '@/components/site/ConsentBanner';
import { isLocale, LOCALES } from '@/i18n/routing';
import { robotsFor, siteUrl } from '@/lib/site';
import { pickMessages } from '@/messages';
import { BASE_CLIENT_NAMESPACES } from '@/messages/namespaces';
import '../../globals.css';

const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('cs-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}})();`;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f8fa' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1220' },
  ],
};

export async function generateMetadata({
  params,
}: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: t('title_default'), template: '%s · ChronoSleep' },
    description: t('description_default'),
    applicationName: 'ChronoSleep',
    robots: robotsFor(false),
    formatDetection: { telephone: false, email: false, address: false },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'site' });

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only-focusable fixed top-2 left-2 z-50 rounded-md bg-primary px-4 py-3 font-semibold text-on-primary no-underline"
        >
          {t('skip_to_content')}
        </a>
        <NextIntlClientProvider locale={locale} messages={pickMessages(locale, BASE_CLIENT_NAMESPACES)}>
          {children}
          <ConsentBanner />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
