import { z } from 'zod';
import { TIME_RE } from './time';

/**
 * Shared input contract (frontend + API). Mirrors `spec/inputs.schema.json`
 * (parity covered by tests/unit/schema-parity.test.ts).
 */
export const timeHHMM = z.string().regex(TIME_RE, 'time');

export const InputsSchema = z.strictObject({
  work_bedtime: timeHHMM,
  sleep_latency_min: z.number().int().min(0).max(120),
  work_wake_time: timeHHMM,
  free_bedtime: timeHHMM,
  free_wake_time: timeHHMM,
  workdays_per_week: z.number().int().min(1).max(6),
  free_day_alarm: z.boolean(),
  wake_flexibility_min: z.number().int().min(0).max(120),
});

export type InputsParsed = z.infer<typeof InputsSchema>;

export const LocaleSchema = z.enum(['es', 'en', 'pt']);
export type Locale = z.infer<typeof LocaleSchema>;

export const EngineParamsSchema = z.object({
  input_time_uncertainty_min: z.number().min(0).max(60),
  planner_max_free_shift_min: z.number().min(0).max(240),
  adult_sleep_min_hours: z.number().min(0).max(24).default(7),
});
