import { calculate, validateInputs } from './engine';
import { deriveInsight, deriveWarnings, type Insight, type WarningItem } from './insight';
import { directionOf } from './format';
import { POPULATION_REFERENCE, populationBands, SOURCES } from './reference';
import { fmtTime, parseTime, pyMod } from './time';
import {
  DEFAULT_ENGINE_PARAMS,
  MODEL_VERSION,
  type CalculationResult,
  type Direction,
  type EngineParams,
  type Inputs,
  type ReferenceBand,
} from './types';

export const REPORT_VERSION = 'chronosleep-report-1.0' as const;

export interface PlanRow {
  day: number;
  day_type: 'work' | 'free';
  bedtime: string;
  /** Approximate sleep onset (bedtime + declared latency). */
  sleep_start: string;
  wake_time: string;
  sleep_duration_hours: number;
  /** Signed minutes vs the current schedule (positive = later). */
  change_minutes: number;
}

export type ScenarioId = 'base' | 'no_flex' | 'current_flex' | 'more_flex';

export interface Scenario {
  id: ScenarioId;
  /** Flexibility assumed (minutes); null for the unplanned baseline. */
  flexibility_min: number | null;
  sjl_hours: number;
}

export type DriverId = 'midpoint_gap' | 'sleep_compensation' | 'flexibility';

export interface Driver {
  id: DriverId;
  /** Primary magnitude in minutes (signed where meaningful). */
  minutes: number;
  direction?: Direction;
  detail?: Record<string, number | string | boolean>;
}

export interface TimelineTrack {
  bedtime: string;
  sleep_start: string;
  wake_time: string;
  mid_sleep: string;
  duration_hours: number;
}

export interface ReportModel {
  report_version: typeof REPORT_VERSION;
  model_version: typeof MODEL_VERSION;
  inputs: Inputs;
  result: CalculationResult;
  warnings: WarningItem[];
  /** FREE preview outputs. */
  preview: {
    social_jetlag_hours: number;
    direction: Direction;
    weekly_timing_chart: { work: TimelineTrack; free: TimelineTrack };
    one_insight: Insight;
  };
  /** INFORME_COMPLETO outputs (ids from spec/outputs_spec.json). */
  full: {
    plan_7d: PlanRow[];
    planned_social_jetlag_hours: number;
    scenario_no_flex: Scenario;
    scenario_more_flex: Scenario;
    scenarios: Scenario[];
    input_sensitivity: {
      low_hours: number;
      high_hours: number;
      uncertainty_min: number;
      is_confidence_interval: false;
    };
    msf_sc: string | null;
    population_reference: {
      band: ReferenceBand;
      reference: typeof POPULATION_REFERENCE;
      bands: ReturnType<typeof populationBands>;
    };
    drivers: Driver[];
    implementation_plan: {
      days: PlanRow[];
      signals: WarningItem[];
    };
    methodology: {
      primary_metric: string;
      backup_metric: string;
      msfsc_role: string;
      planner: string;
      params: {
        planner_max_free_shift_min: number;
        input_time_uncertainty_min: number;
        validity_range_hours: [number, number];
      };
      sources: typeof SOURCES;
    };
    social_jetlag_sleep_corrected_hours: number;
  };
}

function track(bedtime: string, onset: string, wake: string, mid: string, hours: number): TimelineTrack {
  return { bedtime, sleep_start: onset, wake_time: wake, mid_sleep: mid, duration_hours: hours };
}

function plannedFor(inputs: Inputs, flexMin: number, params: EngineParams): number {
  return calculate({ ...inputs, wake_flexibility_min: flexMin }, params).plan
    .planned_social_jetlag_hours;
}

/**
 * Builds the full domain report from validated inputs. This single object feeds
 * the web report, the PDF and the ICS export, so all three stay semantically equal.
 */
export function buildReport(
  rawInputs: unknown,
  params: EngineParams = DEFAULT_ENGINE_PARAMS,
  precomputed?: CalculationResult,
): ReportModel {
  const inputs = validateInputs(rawInputs);
  const result = precomputed ?? calculate(inputs, params);
  const c = result.current;
  const p = result.plan;
  const latency = inputs.sleep_latency_min;

  const plan: PlanRow[] = p.schedule_7d.map((d) => ({
    day: d.day,
    day_type: d.day_type,
    bedtime: d.bedtime,
    sleep_start: fmtTime(pyMod(parseTime(d.bedtime) + latency, 1440)),
    wake_time: d.wake_time,
    sleep_duration_hours: d.sleep_duration_hours,
    change_minutes: d.day_type === 'work' ? p.work_shift_minutes : p.free_shift_minutes,
  }));

  const curFlex = inputs.wake_flexibility_min;
  const moreFlex = Math.min(curFlex + 30, 120);
  const noFlexSjl = plannedFor(inputs, 0, params);
  const moreFlexSjl = plannedFor(inputs, moreFlex, params);

  const scenarioNoFlex: Scenario = { id: 'no_flex', flexibility_min: 0, sjl_hours: noFlexSjl };
  const scenarioMore: Scenario = { id: 'more_flex', flexibility_min: moreFlex, sjl_hours: moreFlexSjl };
  const scenarios: Scenario[] = [
    { id: 'base', flexibility_min: null, sjl_hours: c.social_jetlag_hours },
    scenarioNoFlex,
    { id: 'current_flex', flexibility_min: curFlex, sjl_hours: p.planned_social_jetlag_hours },
    scenarioMore,
  ];

  const direction = directionOf(c.social_jetlag_relative_hours);
  const gapMin = Math.round(c.social_jetlag_hours * 60);
  const compMin = Math.round((c.sleep_duration_free_hours - c.sleep_duration_work_hours) * 60);
  const needMin = Math.round(c.social_jetlag_hours * 60);

  const drivers: Driver[] = [
    { id: 'midpoint_gap', minutes: gapMin, direction },
    {
      id: 'sleep_compensation',
      minutes: compMin,
      detail: {
        work_hours: c.sleep_duration_work_hours,
        free_hours: c.sleep_duration_free_hours,
        alarm: inputs.free_day_alarm,
      },
    },
    {
      id: 'flexibility',
      minutes: curFlex,
      detail: {
        needed_minutes: needMin,
        work_shift_minutes: Math.abs(p.work_shift_minutes),
        free_shift_minutes: Math.abs(p.free_shift_minutes),
        free_cap_minutes: params.planner_max_free_shift_min,
      },
    },
  ];

  const warnings = deriveWarnings(result, params.adult_sleep_min_hours);

  return {
    report_version: REPORT_VERSION,
    model_version: MODEL_VERSION,
    inputs,
    result,
    warnings,
    preview: {
      social_jetlag_hours: c.social_jetlag_hours,
      direction,
      weekly_timing_chart: {
        work: track(
          inputs.work_bedtime,
          c.sleep_onset_work,
          inputs.work_wake_time,
          c.mid_sleep_work,
          c.sleep_duration_work_hours,
        ),
        free: track(
          inputs.free_bedtime,
          c.sleep_onset_free,
          inputs.free_wake_time,
          c.mid_sleep_free,
          c.sleep_duration_free_hours,
        ),
      },
      one_insight: deriveInsight(inputs, result),
    },
    full: {
      plan_7d: plan,
      planned_social_jetlag_hours: p.planned_social_jetlag_hours,
      scenario_no_flex: scenarioNoFlex,
      scenario_more_flex: scenarioMore,
      scenarios,
      input_sensitivity: {
        low_hours: result.uncertainty.low_hours,
        high_hours: result.uncertainty.high_hours,
        uncertainty_min: params.input_time_uncertainty_min,
        is_confidence_interval: false,
      },
      msf_sc: c.msf_sc,
      population_reference: {
        band: c.reference_band,
        reference: POPULATION_REFERENCE,
        bands: populationBands(),
      },
      drivers,
      implementation_plan: { days: plan, signals: warnings },
      methodology: {
        primary_metric: result.methodology.primary_metric,
        backup_metric: result.methodology.backup_metric,
        msfsc_role: result.methodology.msfsc_role,
        planner: result.methodology.planner,
        params: {
          planner_max_free_shift_min: params.planner_max_free_shift_min,
          input_time_uncertainty_min: params.input_time_uncertainty_min,
          validity_range_hours: [3, 14],
        },
        sources: SOURCES,
      },
      social_jetlag_sleep_corrected_hours: c.social_jetlag_sleep_corrected_hours,
    },
  };
}
