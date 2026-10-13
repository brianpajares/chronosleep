import { durationHours, parseTime, pyMod, tryParseTime } from './time';

export type DurationCheck =
  | { ok: true; workHours: number; freeHours: number }
  | { ok: false; which: 'work' | 'free'; hours: number };

export interface DurationInputs {
  work_bedtime: string;
  work_wake_time: string;
  free_bedtime: string;
  free_wake_time: string;
  sleep_latency_min: number;
}

/** Implied sleep episode (hours) for one bedtime/wake pair, or null when a time is not valid yet. */
export function episodeHours(bed: string | undefined, wake: string | undefined, latencyMin: number): number | null {
  const b = tryParseTime(bed);
  const w = tryParseTime(wake);
  if (b === null || w === null) return null;
  return durationHours(pyMod(b + latencyMin, 1440), w);
}

/**
 * Pre-flight check used by the wizard (step 4/5/8) before invoking the engine:
 * implied sleep episodes must be within 3–14 h (inclusive).
 */
export function checkDurations(x: DurationInputs): DurationCheck | null {
  const wb = tryParseTime(x.work_bedtime);
  const ww = tryParseTime(x.work_wake_time);
  const fb = tryParseTime(x.free_bedtime);
  const fw = tryParseTime(x.free_wake_time);
  if (wb === null || ww === null || fb === null || fw === null) return null;
  const lat = x.sleep_latency_min;
  const workHours = durationHours(pyMod(wb + lat, 1440), ww);
  const freeHours = durationHours(pyMod(fb + lat, 1440), fw);
  if (workHours < 3 || workHours > 14) return { ok: false, which: 'work', hours: workHours };
  if (freeHours < 3 || freeHours > 14) return { ok: false, which: 'free', hours: freeHours };
  return { ok: true, workHours, freeHours };
}

/** Wizard default for step 4: step-2 wake time + 60 min. */
export function addMinutesToTime(hhmm: string, minutes: number): string {
  const base = parseTime(hhmm);
  const m = pyMod(base + minutes, 1440);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
