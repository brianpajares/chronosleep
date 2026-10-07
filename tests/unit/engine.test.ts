import { describe, expect, it } from 'vitest';
import { calculate, EngineError, fmtTime, pyMod, pyRound, signedShortestHours } from '@/domain/chronosleep';
import type { Inputs } from '@/domain/chronosleep';

const base: Inputs = {
  work_bedtime: '23:30',
  sleep_latency_min: 15,
  work_wake_time: '06:45',
  free_bedtime: '01:00',
  free_wake_time: '09:00',
  workdays_per_week: 5,
  free_day_alarm: false,
  wake_flexibility_min: 30,
};

function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return e instanceof EngineError ? e.code : `non-engine:${String(e)}`;
  }
  return undefined;
}

describe('time helpers (Python parity)', () => {
  it('pyRound is round-half-to-even like Python', () => {
    expect([0.5, 1.5, 2.5, 3.5, -0.5, -1.5, -2.5, 112.5, 307.5].map(pyRound)).toEqual([
      0, 2, 2, 4, 0, -2, -2, 112, 308,
    ]);
  });
  it('pyMod takes the sign of the divisor', () => {
    expect(pyMod(-22.5, 1440)).toBe(1417.5);
    expect(pyMod(1440, 1440)).toBe(0);
    expect(pyMod(-1440, 1440)).toBe(0);
    expect(pyMod(5.25, 1440)).toBe(5.25);
  });
  it('fmtTime wraps and rounds to the minute', () => {
    expect(fmtTime(1417.5)).toBe('23:38');
    expect(fmtTime(1439.6)).toBe('00:00');
    expect(fmtTime(-1)).toBe('23:59');
  });
  it('exact 12 h tie resolves to +12 (deterministic convention)', () => {
    expect(signedShortestHours(0, 720)).toBe(12);
    expect(signedShortestHours(720, 0)).toBe(12);
  });
});

describe('input contract (AT-03)', () => {
  it('rejects 24:00 and malformed times', () => {
    expect(code(() => calculate({ ...base, work_bedtime: '24:00' }))).toBe('invalid_time');
    expect(code(() => calculate({ ...base, free_wake_time: '9:00' }))).toBe('invalid_time');
    expect(code(() => calculate({ ...base, work_wake_time: '06:60' }))).toBe('invalid_time');
  });
  it('rejects NaN, infinity, booleans and decimals in integer fields', () => {
    expect(code(() => calculate({ ...base, sleep_latency_min: NaN }))).toBe('invalid_integer');
    expect(code(() => calculate({ ...base, sleep_latency_min: Infinity }))).toBe('invalid_integer');
    expect(code(() => calculate({ ...base, workdays_per_week: true }))).toBe('invalid_integer');
    expect(code(() => calculate({ ...base, workdays_per_week: 5.9 }))).toBe('invalid_integer');
    expect(code(() => calculate({ ...base, wake_flexibility_min: '30' }))).toBe('invalid_integer');
  });
  it('rejects out-of-range latency / flexibility / workdays', () => {
    expect(code(() => calculate({ ...base, sleep_latency_min: 121 }))).toBe('out_of_range');
    expect(code(() => calculate({ ...base, sleep_latency_min: -1 }))).toBe('out_of_range');
    expect(code(() => calculate({ ...base, wake_flexibility_min: 121 }))).toBe('out_of_range');
    expect(code(() => calculate({ ...base, workdays_per_week: 0 }))).toBe('out_of_range');
    expect(code(() => calculate({ ...base, workdays_per_week: 7 }))).toBe('out_of_range');
  });
  it('rejects missing inputs and non-boolean alarm', () => {
    const { work_bedtime: _omit, ...rest } = base;
    expect(code(() => calculate(rest))).toBe('missing_inputs');
    expect(code(() => calculate({ ...base, free_day_alarm: 'maybe' }))).toBe('invalid_boolean');
    expect(code(() => calculate({ ...base, free_day_alarm: 2 }))).toBe('invalid_boolean');
  });
  it('accepts the exact 3 h and 14 h duration limits', () => {
    expect(() =>
      calculate({ ...base, work_bedtime: '01:00', sleep_latency_min: 0, work_wake_time: '04:00', free_bedtime: '01:00', free_wake_time: '04:00' }),
    ).not.toThrow();
    expect(() =>
      calculate({ ...base, work_bedtime: '18:00', sleep_latency_min: 0, work_wake_time: '08:00', free_bedtime: '18:00', free_wake_time: '08:00' }),
    ).not.toThrow();
  });
  it('abstains outside 3–14 h with the implied hours', () => {
    try {
      calculate({ ...base, work_bedtime: '01:00', sleep_latency_min: 0, work_wake_time: '03:59' });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(EngineError);
      expect((e as EngineError).code).toBe('sleep_duration_work');
      expect((e as EngineError).hours).toBeCloseTo(2.9833, 3);
    }
    expect(
      code(() => calculate({ ...base, free_bedtime: '18:00', sleep_latency_min: 0, free_wake_time: '08:01' })),
    ).toBe('sleep_duration_free');
  });
  it('accepts string alarm aliases exactly like the reference engine', () => {
    expect(calculate({ ...base, free_day_alarm: 'sí' }).current.msf_sc).toBeNull();
    expect(calculate({ ...base, free_day_alarm: 'no' }).current.msf_sc).not.toBeNull();
  });
});

describe('model properties', () => {
  it('is deterministic and pure', () => {
    const a = calculate(base);
    const b = calculate(structuredClone(base));
    expect(b).toEqual(a);
  });
  it('flexibility is monotonic: more flexibility never increases planned SJL (TV20 -> TV21)', () => {
    const tv = { ...base, work_bedtime: '22:00', sleep_latency_min: 0, work_wake_time: '06:00', free_bedtime: '02:00', free_wake_time: '10:00' };
    let prev = Infinity;
    for (let f = 0; f <= 120; f += 15) {
      const v = calculate({ ...tv, wake_flexibility_min: f }).plan.planned_social_jetlag_hours;
      expect(v).toBeLessThanOrEqual(prev + 1e-9);
      prev = v;
    }
  });
  it('plan preserves observed sleep durations and never leaves 0–12 h SJL range', () => {
    for (let wb = 0; wb < 1440; wb += 97) {
      for (let fb = 0; fb < 1440; fb += 131) {
        const hh = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        const input = { ...base, work_bedtime: hh(wb), free_bedtime: hh(fb), work_wake_time: hh((wb + 8 * 60) % 1440), free_wake_time: hh((fb + 9 * 60) % 1440) };
        const r = calculate(input);
        expect(r.current.social_jetlag_hours).toBeGreaterThanOrEqual(0);
        expect(r.current.social_jetlag_hours).toBeLessThanOrEqual(12);
        expect(r.plan.planned_social_jetlag_hours).toBeLessThanOrEqual(r.current.social_jetlag_hours + 1e-9);
        for (const d of r.plan.schedule_7d) {
          expect(d.sleep_duration_hours).toBe(
            d.day_type === 'work' ? r.current.sleep_duration_work_hours : r.current.sleep_duration_free_hours,
          );
        }
      }
    }
  });
  it('MSFsc is not computed with a free-day alarm', () => {
    expect(calculate({ ...base, free_day_alarm: true }).current.msf_sc).toBeNull();
  });
});
