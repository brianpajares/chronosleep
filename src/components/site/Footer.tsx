import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { MODEL_VERSION } from '@/domain/chronosleep';
import { CookiePreferencesButton } from './ConsentBanner';
import { LogoMark, Wordmark } from './Logo';

export async function Footer() {
  const t = await getTranslations('site');
  const nav = await getTranslations('nav');
  const legal = await getTranslations('legal');
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
              <Link prefetch={false} href="/como-funciona" className={linkClass}>
                {t('footer_methodology')}
              </Link>
            </li>
            <li>
              <Link prefetch={false} href="/faq" className={linkClass}>
                {nav('faq')}
              </Link>
            </li>
            <li>
              <Link prefetch={false} href="/legal/derechos" className={linkClass}>
                {t('footer_rights')}
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label={t('footer_nav')}>
          <ul className="space-y-0.5">
            <li>
              <Link prefetch={false} href="/legal/privacidad" className={linkClass}>
                {nav('privacy')}
              </Link>
            </li>
            <li>
              <Link prefetch={false} href="/legal/terminos" className={linkClass}>
                {nav('terms')}
              </Link>
            </li>
            <li>
              <Link prefetch={false} href="/legal/salud" className={linkClass}>
                {nav('health')}
              </Link>
            </li>
            <li>
              <Link prefetch={false} href="/legal/reembolsos" className={linkClass}>
                {legal('refunds.title')}
              </Link>
            </li>
            <li>
              <Link prefetch={false} href="/legal/cookies" className={linkClass}>
                {legal('cookies.title')}
              </Link>
            </li>
            <li>
              <Link prefetch={false} href="/legal/libro-de-reclamaciones" className={linkClass}>
                {legal('claims.title')}
              </Link>
            </li>
            <li>
              <Link prefetch={false} href="/legal/creditos" className={linkClass}>
                {legal('credits.title')}
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
          <CookiePreferencesButton />
        </div>
      </div>
    </footer>
  );
}
