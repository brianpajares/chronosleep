import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { MODEL_VERSION } from '@/domain/chronosleep';
import { AnalyticsToggle } from './AnalyticsToggle';
import { LogoMark, Wordmark } from './Logo';

export async function Footer() {
  const t = await getTranslations('site');
  const nav = await getTranslations('nav');
  const year = new Date().getUTCFullYear();

  const linkClass =
    'inline-flex min-h-11 items-center text-sm text-muted no-underline hover:text-fg hover:underline';

  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-7" />
            <Wordmark />
          </div>
          <p className="max-w-sm text-sm text-muted">{t('footer_tagline')}</p>
          <p className="max-w-sm text-xs text-muted">{t('footer_validation')}</p>
        </div>

        <nav aria-label={t('footer_nav')}>
          <ul className="space-y-0.5">
            <li>
              <Link href="/como-funciona" className={linkClass}>
                {t('footer_methodology')}
              </Link>
            </li>
            <li>
              <Link href="/faq" className={linkClass}>
                {nav('faq')}
              </Link>
            </li>
            <li>
              <Link href="/legal/derechos" className={linkClass}>
                {t('footer_rights')}
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label={t('footer_nav')}>
          <ul className="space-y-0.5">
            <li>
              <Link href="/legal/privacidad" className={linkClass}>
                {nav('privacy')}
              </Link>
            </li>
            <li>
              <Link href="/legal/terminos" className={linkClass}>
                {nav('terms')}
              </Link>
            </li>
            <li>
              <Link href="/legal/salud" className={linkClass}>
                {nav('health')}
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-line">
        <div className="container-page flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-3 text-xs text-muted">
          <p>
            {t('copyright', { year })} · {t('model_version', { version: MODEL_VERSION })}
          </p>
          <AnalyticsToggle />
        </div>
      </div>
    </footer>
  );
}
