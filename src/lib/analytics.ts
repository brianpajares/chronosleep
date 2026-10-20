'use client';

import { isKnownEvent, sanitizeProps } from './analytics-catalog';
import { getConsent, privacySignalsOptOut } from './consent';
import { gaConfigured, gaEvent, loadGa } from './ga';

/**
 * Client analytics, privacy-first:
 *  - NOTHING loads or is sent until the visitor grants analytics consent (cookie banner);
 *  - DNT / Global Privacy Control always win;
 *  - PostHog: cookieless (memory persistence), no autocapture/recording/profiles;
 *  - GA4 (optional): Consent Mode v2, PII-free, same events mapped to GA recommended names;
 *  - only events/props from spec/analytics_events.json are ever sent (see analytics-catalog).
 */

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

type PostHogClient = {
  capture: (event: string, props?: Record<string, unknown>) => void;
};

let clientPromise: Promise<PostHogClient | null> | null = null;

export function posthogConfigured(): boolean {
  return Boolean(KEY && KEY.startsWith('phc_') && !KEY.includes('REPLACE_ME'));
}

/** True when at least one analytics provider is configured (the banner only shows then). */
export function analyticsAvailable(): boolean {
  return posthogConfigured() || gaConfigured();
}

export function analyticsEnabled(): boolean {
  if (typeof window === 'undefined' || !analyticsAvailable()) return false;
  if (privacySignalsOptOut()) return false;
  return getConsent() === 'granted';
}

function loadPostHog(): Promise<PostHogClient | null> {
  if (!clientPromise) {
    clientPromise = import('posthog-js')
      .then(({ default: posthog }) => {
        posthog.init(KEY as string, {
          api_host: HOST,
          autocapture: false,
          capture_pageview: false,
          capture_pageleave: false,
          disable_session_recording: true,
          disable_surveys: true,
          persistence: 'memory',
          person_profiles: 'never',
          respect_dnt: true,
          ip: false,
        });
        return posthog as unknown as PostHogClient;
      })
      .catch(() => null);
  }
  return clientPromise;
}

/** Starts the configured providers. Safe to call repeatedly; does nothing without consent. */
export function startAnalytics(): void {
  if (!analyticsEnabled()) return;
  if (gaConfigured()) loadGa();
  if (posthogConfigured()) void loadPostHog();
}

/** Fire-and-forget, never throws, never blocks rendering. */
export function track(event: string, props: Record<string, unknown> = {}): void {
  if (!isKnownEvent(event) || !analyticsEnabled()) return;
  const safe = sanitizeProps(event, props);
  const run = () => {
    if (posthogConfigured()) void loadPostHog().then((ph) => ph?.capture(event, safe));
    if (gaConfigured()) {
      loadGa();
      gaEvent(event, safe);
    }
  };
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 2000 });
  else setTimeout(run, 0);
}
