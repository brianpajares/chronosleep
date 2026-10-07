/**
 * ChronoSleep domain types. The shapes mirror `spec/outputs_spec.json`,
 * `spec/inputs.schema.json` and the objects returned by `model/engine_reference.py`.
 */

export const MODEL_VERSION = 'chronosleep-sjl-2.0' as const;

export interface Inputs {
  work_bedtime: string;
  sleep_latency_min: number;
  work_wake_time: string;
  free_bedtime: string;
  free_wake_time: string;
  workdays_per_week: number;
  free_day_alarm: boolean;
  wake_flexibility_min: number;
}

export type InputKey = keyof Inputs;

export const INPUT_KEYS: readonly InputKey[] = [
  'work_bedtime',
  'sleep_latency_min',
  'work_wake_time',
  'free_bedtime',
  'free_wake_time',
  'workdays_per_week',
  'free_day_alarm',
  'wake_flexibility_min',
] as const;

export type ReferenceBand = 'menos_de_1h' | '1h_a_menos_de_2h' | '2h_o_mas';

export interface ScheduleDay {
  day: number;
  day_type: 'work' | 'free';
  bedtime: string;
  wake_time: string;
  sleep_duration_hours: number;
}

export interface CurrentBlock {
  sleep_onset_work: string;
  sleep_onset_free: string;
  sleep_duration_work_hours: number;
  sleep_duration_free_hours: number;
  sleep_duration_week_hours: number;
  mid_sleep_work: string;
  mid_sleep_free: string;
  msf_sc: string | null;
  social_jetlag_relative_hours: number;
  social_jetlag_hours: number;
  social_jetlag_sleep_corrected_hours: number;
  reference_band: ReferenceBand;
}

export interface PlanBlock {
  work_shift_minutes: number;
  free_shift_minutes: number;
  planned_social_jetlag_hours: number;
  planned_social_jetlag_relative_hours: number;
  schedule_7d: ScheduleDay[];
  assumption: string;
}

export interface UncertaintyBlock {
  type: 'worst_case_input_timing_scenario';
  assumption: string;
  low_hours: number;
  high_hours: number;
}

export interface MethodologyBlock {
  primary_metric: string;
  backup_metric: string;
  msfsc_role: string;
  planner: string;
}

/** Exact object produced by the engine (contract tested against `spec/test_vectors.json`). */
export interface CalculationResult {
  model_version: typeof MODEL_VERSION;
  current: CurrentBlock;
  plan: PlanBlock;
  uncertainty: UncertaintyBlock;
  warnings: string[];
  methodology: MethodologyBlock;
}

export interface EngineParams {
  input_time_uncertainty_min: number;
  planner_max_free_shift_min: number;
  adult_sleep_min_hours: number;
}

export const DEFAULT_ENGINE_PARAMS: EngineParams = {
  input_time_uncertainty_min: 15,
  planner_max_free_shift_min: 90,
  adult_sleep_min_hours: 7,
};

export type Direction = 'earlier' | 'aligned' | 'later';
