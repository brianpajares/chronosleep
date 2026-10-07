import catalog from '../../spec/analytics_events.json';

/**
 * Analytics allow-list derived from spec/analytics_events.json.
 * Anything not in the catalog is dropped: no emails, no HH:MM, no free text, no unknown props.
 */
export type EventName = (typeof catalog.events)[number]['event'];

const ALLOWED: Map<string, Set<string>> = new Map(
  catalog.events.map((e) => [e.event, new Set<string>(e.props)]),
);

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
// Exact clock times such as 23:30 or 7:05 (also catches times embedded in longer strings).
const CLOCK_RE = /(?:^|[^\d])(?:[01]?\d|2[0-3]):[0-5]\d(?:[^\d]|$)/;
const SAFE_STRING_RE = /^[A-Za-z0-9_.:<>=+\-\s]{1,64}$/;

export type SafeProps = Record<string, string | number | boolean>;

export function isKnownEvent(name: string): name is EventName {
  return ALLOWED.has(name);
}

export function allowedProps(name: string): readonly string[] {
  return [...(ALLOWED.get(name) ?? [])];
}

export function isSafeValue(value: unknown): value is string | number | boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return true;
  if (typeof value === 'string') {
    if (EMAIL_RE.test(value) || CLOCK_RE.test(value)) return false;
    return SAFE_STRING_RE.test(value);
  }
  return false;
}

/** Returns only approved, privacy-safe properties for an event (empty object for unknown events). */
export function sanitizeProps(name: string, props: Record<string, unknown> = {}): SafeProps {
  const allowed = ALLOWED.get(name);
  const out: SafeProps = {};
  if (!allowed) return out;
  for (const [k, v] of Object.entries(props)) {
    if (!allowed.has(k)) continue;
    if (isSafeValue(v)) out[k] = v;
  }
  return out;
}

/* ---------- bucketing helpers (never send exact values) ---------- */

export function bucketMinutes(min: number): '0' | '1-30' | '31-60' | '61-120' {
  if (min <= 0) return '0';
  if (min <= 30) return '1-30';
  if (min <= 60) return '31-60';
  return '61-120';
}

export function bucketElapsedMs(ms: number): string {
  if (ms < 2_000) return 'lt_2s';
  if (ms < 5_000) return '2_5s';
  if (ms < 10_000) return '5_10s';
  if (ms < 30_000) return '10_30s';
  return 'ge_30s';
}

export function bucketComputeMs(ms: number): string {
  if (ms < 50) return 'lt_50ms';
  if (ms < 100) return '50_100ms';
  if (ms < 500) return '100_500ms';
  return 'ge_500ms';
}

export function referrerGroup(referrer: string, ownHost: string): string {
  if (!referrer) return 'direct';
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '');
    if (host === ownHost.replace(/^www\./, '')) return 'internal';
    if (/(google|bing|duckduckgo|yahoo|ecosia|brave|baidu|yandex)\./.test(host)) return 'search';
    if (/(facebook|instagram|twitter|x\.com|t\.co|linkedin|reddit|tiktok|youtube|pinterest|threads)/.test(host)) {
      return 'social';
    }
    return 'other';
  } catch {
    return 'other';
  }
}
