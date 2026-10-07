'use client';

import { useLocale } from 'next-intl';
import { useEffect } from 'react';
import { referrerGroup } from '@/lib/analytics-catalog';
import { track } from '@/lib/analytics';

/** Emits `landing_view` once per mount with privacy-safe properties only. */
export function LandingViewTracker({ countryCode }: { countryCode?: string }) {
  const locale = useLocale();
  useEffect(() => {
    track('landing_view', {
      locale,
      country_code_if_explicit: countryCode,
      referrer_group: referrerGroup(document.referrer, window.location.hostname),
    });
  }, [locale, countryCode]);
  return null;
}
