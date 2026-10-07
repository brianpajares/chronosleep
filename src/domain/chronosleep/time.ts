import { EngineError } from './errors';

export const MINUTES_PER_DAY = 1440;
export const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

/** Python-compatible float modulo: the result takes the sign of the divisor. */
export function pyMod(a: number, n: number): number {
  const r = a % n;
  if (r === 0) return 0;
  return r < 0 !== n < 0 ? r + n : r;
}

/** Python 3 `round(x)` — round-half-to-even, returned as a plain integer. */
export function pyRound(x: number): number {
  const f = Math.floor(x);
  const diff = x - f;
  let out: number;
  if (diff < 0.5) out = f;
  else if (diff > 0.5) out = f + 1;
  else out = f % 2 === 0 ? f : f + 1;
  return out === 0 ? 0 : out;
}

/** Python `round(x, 4)`: correct decimal rounding of the exact binary value. */
export function round4(x: number): number {
  const out = Number(x.toFixed(4));
  return out === 0 ? 0 : out;
}

/** Parses HH:MM (00:00–23:59) into minutes since midnight. */
export function parseTime(value: unknown, field?: string): number {
  if (typeof value !== 'string' || !TIME_RE.test(value)) {
    throw new EngineError(
      'invalid_time',
      `Hora inválida ${JSON.stringify(value)}; use HH:MM (00:00–23:59).`,
      { field },
    );
  }
  const [h, m] = value.split(':').map(Number) as [number, number];
  return h * 60 + m;
}

/** Formats (possibly fractional) minutes as HH:MM using Python rounding. */
export function fmtTime(minutes: number): string {
  const m = pyMod(pyRound(minutes), MINUTES_PER_DAY);
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function durationHours(startMin: number, endMin: number): number {
  return pyMod(endMin - startMin, MINUTES_PER_DAY) / 60;
}

export function midpointMin(startMin: number, durationH: number): number {
  return pyMod(startMin + durationH * 30, MINUTES_PER_DAY);
}

/** Signed shortest circular interval b-a in hours, within [-12, 12]; exact 12 h ties map to +12. */
export function signedShortestHours(aMin: number, bMin: number): number {
  let d = pyMod(bMin - aMin + 720, 1440) - 720;
  if (Math.abs(d + 720) < 1e-9) d = 720;
  return d / 60;
}

/** Converts an HH:MM string into minutes with no validation errors (null when invalid). */
export function tryParseTime(value: unknown): number | null {
  return typeof value === 'string' && TIME_RE.test(value) ? parseTime(value) : null;
}

export function minutesToHHMM(totalMinutes: number): string {
  return fmtTime(totalMinutes);
}
