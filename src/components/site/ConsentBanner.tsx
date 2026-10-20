'use client';

import { Cookie } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { analyticsAvailable, startAnalytics } from '@/lib/analytics';
import { revokeGa, gaPageView } from '@/lib/ga';
import { getConsent, onOpenPreferences, privacySignalsOptOut, setConsent, useConsent } from '@/lib/consent';

/**
 * Cookie banner: appears only when an analytics provider is configured. "Accept" and "Reject" have
 * the same visual weight; the choice can be changed any time from the footer. No scripts run
 * before consent (see lib/analytics.ts).
 */
export function ConsentBanner() {
  const t = useTranslations('cookies');
  const consent = useConsent();
  const pathname = usePathname();
  const [reopened, setReopened] = useState(false);
  const available = analyticsAvailable();

  useEffect(() => onOpenPreferences(() => setReopened(true)), []);

  // Start providers once consent exists; count SPA page views with sanitised paths.
  useEffect(() => {
    if (consent === 'granted' && !privacySignalsOptOut()) startAnalytics();
    if (consent === 'denied') revokeGa();
  }, [consent]);

  useEffect(() => {
    if (consent === 'granted' && !privacySignalsOptOut()) gaPageView(pathname);
  }, [pathname, consent]);

  if (!available || privacySignalsOptOut()) return null;
  if (consent !== null && !reopened) return null;

  const choose = (v: boolean) => {
    setConsent(v);
    setReopened(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-title"
      aria-describedby="cookie-desc"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface p-4 shadow-lg sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-md sm:rounded-lg sm:border"
    >
      <div className="flex items-start gap-3">
        <Cookie aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-primary" />
        <div>
          <h2 id="cookie-title" className="font-semibold">
            {t('title')}
          </h2>
          <p id="cookie-desc" className="mt-1 text-sm text-muted">
            {t('body')}{' '}
            <Link href="/legal/cookies" className="font-semibold">
              {t('policy')}
            </Link>
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => choose(false)} data-testid="cookies-reject">
              {t('reject')}
            </Button>
            <Button variant="secondary" onClick={() => choose(true)} data-testid="cookies-accept">
              {t('accept')}
            </Button>
          </div>
          {getConsent() ? <p className="mt-2 text-xs text-muted">{t('current', { value: consent === 'granted' ? t('accept') : t('reject') })}</p> : null}
        </div>
      </div>
    </div>
  );
}

/** Footer link to reopen the banner (needed so consent can be changed as easily as it was given). */
export function CookiePreferencesButton() {
  const t = useTranslations('cookies');
  const [show, setShow] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only config read after mount
  useEffect(() => setShow(analyticsAvailable()), []);
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event('cs:consent-open'))}
      className="inline-flex min-h-11 items-center rounded-md px-3 text-sm text-muted hover:bg-subtle hover:text-fg"
    >
      {t('preferences')}
    </button>
  );
}
