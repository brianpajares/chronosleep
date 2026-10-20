'use client';

import { useSyncExternalStore } from 'react';

/**
 * Cookie/analytics consent (audit B-5, GA Consent Mode v2). Nothing non-essential — no analytics
 * script, no PostHog, no Google tag — is loaded until the visitor presses "Accept". The choice
 * (and its timestamp) lives in localStorage and can be changed at any time from the footer.
 */
export type Consent = 'granted' | 'denied' | null;

const KEY = 'cs_consent_v1';
const EVENT = 'cs:consent';
const OPEN_EVENT = 'cs:consent-open';

interface Stored {
  analytics: boolean;
  at: string;
}

function read(): Stored | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

export function getConsent(): Consent {
  if (typeof window === 'undefined') return null;
  const s = read();
  return s ? (s.analytics ? 'granted' : 'denied') : null;
}

export function setConsent(analytics: boolean): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ analytics, at: new Date().toISOString() } satisfies Stored));
  } catch {
    /* storage blocked: the choice only applies to this page view */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function openConsentPreferences(): void {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function onConsentChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

export function onOpenPreferences(cb: () => void): () => void {
  window.addEventListener(OPEN_EVENT, cb);
  return () => window.removeEventListener(OPEN_EVENT, cb);
}

export function useConsent(): Consent {
  return useSyncExternalStore(onConsentChange, getConsent, () => null);
}

/** Browser-level opt-outs always win (DNT / Global Privacy Control). */
export function privacySignalsOptOut(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack === '1' || nav.globalPrivacyControl === true;
}
