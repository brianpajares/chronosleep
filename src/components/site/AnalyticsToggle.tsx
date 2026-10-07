'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import {
  analyticsAvailable,
  analyticsEnabled,
  setAnalyticsEnabled,
} from '@/lib/analytics';

/** Opt-out switch for anonymous analytics. Hidden when analytics are not configured. */
export function AnalyticsToggle() {
  const t = useTranslations('site');
  const [available, setAvailable] = useState(false);
  const [on, setOn] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read client-only preferences after mount
    setAvailable(analyticsAvailable());
    setOn(analyticsEnabled());
  }, []);

  if (!available) return null;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      title={t('analytics_hint')}
      onClick={() => {
        const next = !on;
        setAnalyticsEnabled(next);
        setOn(next);
      }}
      className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-muted hover:bg-subtle hover:text-fg"
    >
      <span
        aria-hidden="true"
        className={`inline-block size-2.5 rounded-full ${on ? 'bg-success' : 'bg-locked'}`}
      />
      {on ? t('analytics_on') : t('analytics_off')}
    </button>
  );
}
