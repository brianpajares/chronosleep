import { directionOf } from './format';
import { parseTime, signedShortestHours } from './time';
import type { CalculationResult, Direction, Inputs } from './types';

/**
 * `one_insight` (free preview): one descriptive, non-clinical sentence derived from
 * rules on SJL + sleep timing + alarm. Returned as structured data; copy comes from i18n.
 */
export type InsightKey = 'aligned' | 'wake_dominant' | 'bed_dominant' | 'both';

export interface Insight {
  key: InsightKey;
  direction: Direction;
  /** Absolute difference between free-day and work-day bedtime (minutes, circular). */
  bed_diff_min: number;
  /** Absolute difference between free-day and work-day wake time (minutes, circular). */
  wake_diff_min: number;
  alarm_note: boolean;
}

const DOMINANCE_MARGIN_MIN = 15;

export function deriveInsight(inputs: Inputs, result: CalculationResult): Insight {
  const direction = directionOf(result.current.social_jetlag_relative_hours);
  const bed = Math.round(
    Math.abs(signedShortestHours(parseTime(inputs.work_bedtime), parseTime(inputs.free_bedtime))) *
      60,
  );
  const wake = Math.round(
    Math.abs(signedShortestHours(parseTime(inputs.work_wake_time), parseTime(inputs.free_wake_time))) *
      60,
  );

  let key: InsightKey;
  if (direction === 'aligned') key = 'aligned';
  else if (wake >= bed + DOMINANCE_MARGIN_MIN) key = 'wake_dominant';
  else if (bed >= wake + DOMINANCE_MARGIN_MIN) key = 'bed_dominant';
  else key = 'both';

  return {
    key,
    direction,
    bed_diff_min: bed,
    wake_diff_min: wake,
    alarm_note: inputs.free_day_alarm && direction !== 'aligned',
  };
}

export type WarningCode =
  | 'weekly_sleep_below_min'
  | 'free_alarm_no_msfsc'
  | 'sjl_very_high'
  | 'sleep_very_long';

export interface WarningItem {
  code: WarningCode;
  /** Average weekly sleep (hours) for `weekly_sleep_below_min`. */
  value_hours?: number;
}

/** Structured mirror of `result.warnings` (engine strings stay Spanish for contract parity). */
export function deriveWarnings(result: CalculationResult, adultMinHours = 7): WarningItem[] {
  const out: WarningItem[] = [];
  const c = result.current;
  if (c.sleep_duration_week_hours < adultMinHours) {
    out.push({ code: 'weekly_sleep_below_min', value_hours: c.sleep_duration_week_hours });
  }
  if (c.msf_sc === null) out.push({ code: 'free_alarm_no_msfsc' });
  if (c.social_jetlag_hours >= 6) out.push({ code: 'sjl_very_high' });
  if (Math.max(c.sleep_duration_work_hours, c.sleep_duration_free_hours) >= 12) {
    out.push({ code: 'sleep_very_long' });
  }
  return out;
}
