import type { Direction } from './types';

export type FormatLocale = 'es' | 'en' | 'pt';

/** Hours (decimal) -> whole minutes using half-up rounding (1.875 h -> 113 min -> 1 h 53 min). */
export function hoursToMinutes(hours: number): number {
  return Math.round(hours * 60 + 1e-9);
}

export interface HM {
  h: number;
  m: number;
}

export function splitHM(hours: number): HM {
  const total = hoursToMinutes(hours);
  return { h: Math.floor(total / 60), m: total % 60 };
}

/** "1 h 53 min", "45 min", "2 h", "0 min". Units are language-neutral (h / min). */
export function formatHoursMinutes(hours: number): string {
  const { h, m } = splitHM(hours);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export function formatMinutes(minutes: number): string {
  return formatHoursMinutes(Math.abs(minutes) / 60);
}

/** Accessible, locale-aware 24h/12h clock. `HH:MM` stays the internal/contract format. */
export function formatClock(hhmm: string, locale: FormatLocale): string {
  const [hs, ms] = hhmm.split(':');
  const h = Number(hs);
  const m = Number(ms);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return hhmm;
  if (locale === 'en') {
    const suffix = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export type SjlBand = 'lt_30m' | '30m_1h' | '1h_2h' | '2h_3h' | 'ge_3h';

/** Coarse band for analytics, storage and admin: never the exact figure. */
export function sjlBand(hours: number): SjlBand {
  const min = hoursToMinutes(hours);
  if (min < 30) return 'lt_30m';
  if (min < 60) return '30m_1h';
  if (min < 120) return '1h_2h';
  if (min < 180) return '2h_3h';
  return 'ge_3h';
}

export function directionOf(relativeHours: number): Direction {
  if (hoursToMinutes(Math.abs(relativeHours)) === 0) return 'aligned';
  return relativeHours > 0 ? 'later' : 'earlier';
}

/** Hours with at most 3 decimals — only for methodology sections. */
export function formatDecimalHours(hours: number): string {
  return String(Number(hours.toFixed(3)));
}

/** Deterministic, opaque, human-friendly verification id like `CS-7F4K-2M9Q`. */
export function verificationIdFromUuid(uuid: string): string {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const hex = uuid.replace(/[^0-9a-f]/gi, '').toLowerCase();
  let out = '';
  for (let i = 0; i < 8; i++) {
    const byte = parseInt(hex.slice(i * 2, i * 2 + 2) || '0', 16);
    out += alphabet[byte % alphabet.length];
  }
  return `CS-${out.slice(0, 4)}-${out.slice(4, 8)}`;
}
