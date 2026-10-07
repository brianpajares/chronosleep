import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from './LanguageSwitcher';
import { LogoMark, Wordmark } from './Logo';
import { ThemeToggle } from './ThemeToggle';

/**
 * Public header (logo → how it works → FAQ → language → CTA). In the funnel the navigation
 * is reduced to logo + language + help so users do not leave by accident.
 */
export async function Header({ variant = 'public' }: { variant?: 'public' | 'funnel' }) {
  const t = await getTranslations('site');
  const nav = await getTranslations('nav');

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="container-page flex min-h-16 items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2.5 no-underline" aria-label={t('logo_label')}>
          <LogoMark />
          <Wordmark />
        </Link>

        {variant === 'public' ? (
          <nav aria-label={t('main_nav')} className="hidden items-center gap-1 md:flex">
            <Link
              href="/como-funciona"
              className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-fg no-underline hover:bg-subtle"
            >
              {nav('how')}
            </Link>
            <Link
              href="/faq"
              className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-fg no-underline hover:bg-subtle"
            >
              {nav('faq')}
            </Link>
          </nav>
        ) : null}

        <div className="flex items-center gap-1 sm:gap-2">
          {variant === 'funnel' ? (
            <Link
              href="/faq"
              className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-fg no-underline hover:bg-subtle"
            >
              {t('help')}
            </Link>
          ) : null}
          <LanguageSwitcher />
          <ThemeToggle />
          {variant === 'public' ? (
            <Button asChild size="sm" className="ml-1 hidden sm:inline-flex">
              <Link href="/calcular/1">{nav('calculate')}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
