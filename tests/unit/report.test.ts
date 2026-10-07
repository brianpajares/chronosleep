import { describe, expect, it } from 'vitest';
import outputsSpec from '../../spec/outputs_spec.json';
import vectors from '../../spec/test_vectors.json';
import {
  buildIcs,
  buildReport,
  checkDurations,
  formatClock,
  formatHoursMinutes,
  verificationIdFromUuid,
} from '@/domain/chronosleep';

const tv01 = vectors[0]!;

describe('report builder covers every output id in spec/outputs_spec.json (AT-05, AT-13)', () => {
  const report = buildReport(tv01.inputs);

  it('free preview ids', () => {
    for (const r of outputsSpec.free_preview.results) {
      if (r.id === 'social_jetlag_hours') expect(report.preview.social_jetlag_hours).toBe(1.875);
      if (r.id === 'weekly_timing_chart') {
        expect(report.preview.weekly_timing_chart.work.mid_sleep).toBe('03:15');
        expect(report.preview.weekly_timing_chart.free.mid_sleep).toBe('05:08');
      }
      if (r.id === 'one_insight') expect(report.preview.one_insight.key).toBeTruthy();
    }
  });

  it('full report ids are all present', () => {
    for (const r of outputsSpec.full_report.results) {
      expect(report.full, r.id).toHaveProperty(r.id);
    }
  });

  it('scenarios follow the spec (no flex = 0, more flex = min(current+30, 120))', () => {
    expect(report.full.scenario_no_flex.flexibility_min).toBe(0);
    expect(report.full.scenario_more_flex.flexibility_min).toBe(60);
    const capped = buildReport({ ...tv01.inputs, wake_flexibility_min: 110 });
    expect(capped.full.scenario_more_flex.flexibility_min).toBe(120);
  });

  it('plan rows carry sleep start (bedtime + latency) and change vs current', () => {
    const day1 = report.full.plan_7d[0]!;
    expect(day1.bedtime).toBe('00:00');
    expect(day1.sleep_start).toBe('00:15');
    expect(day1.change_minutes).toBe(30);
    expect(report.full.plan_7d[5]!.change_minutes).toBe(-82);
  });

  it('uncertainty is labelled as a sensitivity range, never a confidence interval', () => {
    expect(report.full.input_sensitivity.is_confidence_interval).toBe(false);
  });

  it('MSFsc is null (not "NA") when a free-day alarm is used', () => {
    const r = buildReport({ ...tv01.inputs, free_day_alarm: true });
    expect(r.full.msf_sc).toBeNull();
    expect(r.warnings.map((w) => w.code)).toContain('free_alarm_no_msfsc');
  });

  it('is JSON-serialisable and free of undefined', () => {
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });
});

describe('formatting', () => {
  it('rounds 1.875 h to 1 h 53 min (UX spec)', () => {
    expect(formatHoursMinutes(1.875)).toBe('1 h 53 min');
    expect(formatHoursMinutes(0)).toBe('0 min');
    expect(formatHoursMinutes(0.75)).toBe('45 min');
    expect(formatHoursMinutes(2)).toBe('2 h');
    expect(formatHoursMinutes(1.375)).toBe('1 h 23 min');
    expect(formatHoursMinutes(2.375)).toBe('2 h 23 min');
  });
  it('clock follows locale convention', () => {
    expect(formatClock('23:30', 'es')).toBe('23:30');
    expect(formatClock('23:30', 'en')).toBe('11:30 PM');
    expect(formatClock('00:05', 'en')).toBe('12:05 AM');
    expect(formatClock('12:00', 'en')).toBe('12:00 PM');
  });
  it('verification ids are opaque, deterministic and carry no input data', () => {
    const id = verificationIdFromUuid('7f4k2m9q-0000-4000-8000-000000000000'.replace(/[^0-9a-f-]/g, 'a'));
    expect(id).toMatch(/^CS-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(verificationIdFromUuid('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')).toBe(
      verificationIdFromUuid('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'),
    );
  });
});

describe('wizard duration pre-check (UX 3–14 h)', () => {
  it('flags the offending episode with its hours', () => {
    const r = checkDurations({
      work_bedtime: '23:00',
      work_wake_time: '23:30',
      free_bedtime: '23:00',
      free_wake_time: '07:00',
      sleep_latency_min: 15,
    });
    expect(r).toMatchObject({ ok: false, which: 'work' });
  });
  it('returns null until all times are valid, ok when plausible', () => {
    expect(
      checkDurations({ work_bedtime: '', work_wake_time: '06:00', free_bedtime: '00:00', free_wake_time: '08:00', sleep_latency_min: 15 }),
    ).toBeNull();
    expect(
      checkDurations({ work_bedtime: '23:00', work_wake_time: '06:00', free_bedtime: '00:00', free_wake_time: '08:00', sleep_latency_min: 15 }),
    ).toMatchObject({ ok: true });
  });
});

describe('ICS export (AT-14)', () => {
  const report = buildReport(tv01.inputs);
  const ics = buildIcs(report.full.plan_7d, {
    startDate: new Date(Date.UTC(2026, 9, 12)),
    id: 'CS-TEST',
    now: new Date(Date.UTC(2026, 9, 7, 12, 0, 0)),
    labels: {
      workSummary: 'ChronoSleep: sueño (día con obligaciones)',
      freeSummary: 'ChronoSleep: sueño (día libre)',
      description: 'Simulación de horario; información educativa, no diagnóstico.',
    },
  });

  it('has 7 events with CRLF line endings', () => {
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(7);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
  });
  it('crossing-midnight episodes end the next day', () => {
    expect(ics).toContain('DTSTART:20261012T000000');
    expect(ics).toContain('DTEND:20261012T071500');
    expect(ics).toContain('DTSTART:20261017T233800');
    expect(ics).toContain('DTEND:20261018T073800');
  });
  it('folds long lines at 75 octets', () => {
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});
