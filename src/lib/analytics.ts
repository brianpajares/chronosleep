'use client';

import { isKnownEvent, sanitizeProps } from './analytics-catalog';

/**
 * Client analytics (PostHog), privacy-first:
 *  - cookieless (memory persistence), no autocapture, no session recording, no person profiles;
 *  - honours DNT, Global Privacy Control and the in-app opt-out;
 *  - only events/props from spec/analytics_events.json are ever sent (see analytics-catalog).
 */

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';
export const ANALYTICS_STORAGE_KEY = 'cs_analytics';

type PostHogClient = {
  capture: (event: string, props?: Record<string, unknown>) => void;
};

let clientPromise: Promise<PostHogClient | null> | null = null;

export function analyticsAvailable(): boolean {
  return Boolean(KEY && KEY.startsWith('phc_') && !KEY.includes('REPLACE_ME'));
}

export function analyticsEnabled(): boolean {
  if (typeof window === 'undefined' || !analyticsAvailable()) return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (nav.doNotTrack === '1' || nav.globalPrivacyControl === true) return false;
  try {
    return window.localStorage.getItem(ANALYTICS_STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setAnalyticsEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(ANALYTICS_STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    /* storage unavailable: preference only lives for this view */
  }
}

function load(): Promise<PostHogClient | null> {
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

/** Fire-and-forget, never throws, never blocks rendering. */
export function track(event: string, props: Record<string, unknown> = {}): void {
  if (!isKnownEvent(event) || !analyticsEnabled()) return;
  const safe = sanitizeProps(event, props);
  const run = () => {
    void load().then((ph) => ph?.capture(event, safe));
  };
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 2000 });
  else setTimeout(run, 0);
}
