import { EngineError } from './errors';
import {
  durationHours,
  fmtTime,
  midpointMin,
  parseTime,
  pyMod,
  pyRound,
  round4,
  signedShortestHours,
} from './time';
import {
  DEFAULT_ENGINE_PARAMS,
  MODEL_VERSION,
  type CalculationResult,
  type EngineParams,
  type Inputs,
  type ReferenceBand,
  type ScheduleDay,
} from './types';

/**
 * ChronoSleep engine v2.0 — a 1:1 TypeScript port of `model/engine_reference.py`.
 * Pure and deterministic: no I/O, no randomness, no LLM, no clock.
 * The Python implementation stays in the repo as the regression oracle.
 */

const REQUIRED: readonly (keyof Inputs)[] = [
  'work_bedtime',
  'sleep_latency_min',
  'work_wake_time',
  'free_bedtime',
  'free_wake_time',
  'workdays_per_week',
  'free_day_alarm',
  'wake_flexibility_min',
];

const INT_RANGES: readonly (readonly [keyof Inputs, number, number])[] = [
  ['sleep_latency_min', 0, 120],
  ['workdays_per_week', 1, 6],
  ['wake_flexibility_min', 0, 120],
];

const norm0 = (x: number): number => (x === 0 ? 0 : x);

/** Strict input validation (port of `_validate_inputs`). Returns normalised inputs. */
export function validateInputs(raw: unknown): Inputs {
  const src = (raw ?? {}) as Record<string, unknown>;
  const missing = REQUIRED.filter((k) => !(k in src));
  if (missing.length > 0) {
    throw new EngineError('missing_inputs', `Faltan inputs: ${missing.join(', ')}`, {
      field: missing[0],
    });
  }
  const x: Record<string, unknown> = { ...src };

  for (const k of ['work_bedtime', 'work_wake_time', 'free_bedtime', 'free_wake_time'] as const) {
    parseTime(x[k], k);
  }

  if (typeof x.free_day_alarm === 'string') {
    const s = x.free_day_alarm.toLowerCase();
    if (['true', '1', 'si', 'sí', 'yes'].includes(s)) x.free_day_alarm = true;
    else if (['false', '0', 'no'].includes(s)) x.free_day_alarm = false;
    else
      throw new EngineError('invalid_boolean', 'free_day_alarm debe ser booleano.', {
        field: 'free_day_alarm',
      });
  }
  if (typeof x.free_day_alarm !== 'boolean') {
    throw new EngineError('invalid_boolean', 'free_day_alarm debe ser booleano.', {
      field: 'free_day_alarm',
    });
  }

  for (const [k, lo, hi] of INT_RANGES) {
    const v = x[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v)) {
      throw new EngineError('invalid_integer', `${k} debe ser entero finito.`, { field: k });
    }
    if (v < lo || v > hi) {
      throw new EngineError('out_of_range', `${k} fuera de rango [${lo}, ${hi}].`, { field: k });
    }
    x[k] = norm0(v);
  }
  return x as unknown as Inputs;
}

function referenceBand(sjl: number): ReferenceBand {
  if (sjl < 1.0) return 'menos_de_1h';
  if (sjl < 2.0) return '1h_a_menos_de_2h';
  return '2h_o_mas';
}

export function calculate(
  inputs: unknown,
  params: EngineParams = DEFAULT_ENGINE_PARAMS,
): CalculationResult {
  const x = validateInputs(inputs);

  const latency = x.sleep_latency_min;
  const workBed = parseTime(x.work_bedtime);
  const workWake = parseTime(x.work_wake_time);
  const freeBed = parseTime(x.free_bedtime);
  const freeWake = parseTime(x.free_wake_time);
  const wd = x.workdays_per_week;
  const fd = 7 - wd;

  const soW = pyMod(workBed + latency, 1440);
  const soF = pyMod(freeBed + latency, 1440);
  const sdW = durationHours(soW, workWake);
  const sdF = durationHours(soF, freeWake);
  if (!(sdW >= 3.0 && sdW <= 14.0)) {
    throw new EngineError(
      'sleep_duration_work',
      `Duración de sueño en días de trabajo no plausible para el MVP: ${sdW.toFixed(2)} h.`,
      { hours: sdW },
    );
  }
  if (!(sdF >= 3.0 && sdF <= 14.0)) {
    throw new EngineError(
      'sleep_duration_free',
      `Duración de sueño en días libres no plausible para el MVP: ${sdF.toFixed(2)} h.`,
      { hours: sdF },
    );
  }

  const msw = midpointMin(soW, sdW);
  const msf = midpointMin(soF, sdF);
  const sdWeek = (wd * sdW + fd * sdF) / 7.0;

  let msfSc: number | null;
  if (x.free_day_alarm) msfSc = null;
  else if (sdF <= sdW) msfSc = msf;
  else msfSc = pyMod(msf - (sdF - sdWeek) * 30.0, 1440);

  const sjlRel = signedShortestHours(msw, msf);
  const sjl = Math.abs(sjlRel);

  // Backup / methodological sensitivity: Jankowski (2017) sleep-corrected SJL,
  // shorter circular interval. Disputed; never the main figure.
  let sjlSc: number;
  if (sdW > sdF && workWake <= freeWake) {
    sjlSc = Math.abs(signedShortestHours(workWake, freeWake));
  } else {
    sjlSc = Math.abs(signedShortestHours(soW, soF));
  }

  // Deterministic planner: preserves sleep durations, only moves timing.
  const direction = Math.abs(sjlRel) < 1e-12 ? 0 : sjlRel > 0 ? 1 : -1;
  const workCap = x.wake_flexibility_min;
  const freeCap = params.planner_max_free_shift_min;
  const need = sjl * 60.0;
  const workShift = norm0(direction * Math.min(need, workCap));
  const remaining = Math.max(0.0, need - Math.abs(workShift));
  const freeShift = norm0(-direction * Math.min(remaining, freeCap));

  const planMsw = pyMod(msw + workShift, 1440);
  const planMsf = pyMod(msf + freeShift, 1440);
  const planSjlRel = signedShortestHours(planMsw, planMsf);
  const planSjl = Math.abs(planSjlRel);

  const workBedPlan = pyMod(workBed + workShift, 1440);
  const workWakePlan = pyMod(workWake + workShift, 1440);
  const freeBedPlan = pyMod(freeBed + freeShift, 1440);
  const freeWakePlan = pyMod(freeWake + freeShift, 1440);

  const schedule: ScheduleDay[] = [];
  for (let day = 1; day <= 7; day++) {
    const isWork = day <= wd;
    schedule.push({
      day,
      day_type: isWork ? 'work' : 'free',
      bedtime: fmtTime(isWork ? workBedPlan : freeBedPlan),
      wake_time: fmtTime(isWork ? workWakePlan : freeWakePlan),
      sleep_duration_hours: round4(isWork ? sdW : sdF),
    });
  }

  const uncertaintyMin = params.input_time_uncertainty_min;
  const sjlDeltaH = (2.0 * uncertaintyMin) / 60.0;

  const warnings: string[] = [];
  const adultMin = params.adult_sleep_min_hours;
  if (sdWeek < adultMin) {
    warnings.push(
      `El promedio semanal estimado (${sdWeek.toFixed(2)} h) está por debajo de ${adultMin.toFixed(0)} h; ` +
        'el plan de alineación no sustituye una evaluación del tiempo total de sueño.',
    );
  }
  if (x.free_day_alarm) {
    warnings.push('MSFsc no se calcula cuando se usa alarma en días libres.');
  }
  if (sjl >= 6) {
    warnings.push(
      'Desfase muy alto para el alcance del MVP; revisar inputs y considerar orientación profesional si persiste.',
    );
  }
  if (Math.max(sdW, sdF) >= 12) {
    warnings.push('Duración de sueño muy alta; revisar que las horas ingresadas sean correctas.');
  }

  return {
    model_version: MODEL_VERSION,
    current: {
      sleep_onset_work: fmtTime(soW),
      sleep_onset_free: fmtTime(soF),
      sleep_duration_work_hours: round4(sdW),
      sleep_duration_free_hours: round4(sdF),
      sleep_duration_week_hours: round4(sdWeek),
      mid_sleep_work: fmtTime(msw),
      mid_sleep_free: fmtTime(msf),
      msf_sc: msfSc === null ? null : fmtTime(msfSc),
      social_jetlag_relative_hours: round4(sjlRel),
      social_jetlag_hours: round4(sjl),
      social_jetlag_sleep_corrected_hours: round4(sjlSc),
      reference_band: referenceBand(sjl),
    },
    plan: {
      work_shift_minutes: norm0(pyRound(workShift)),
      free_shift_minutes: norm0(pyRound(freeShift)),
      planned_social_jetlag_hours: round4(planSjl),
      planned_social_jetlag_relative_hours: round4(planSjlRel),
      schedule_7d: schedule,
      assumption: 'adherencia inmediata al horario; no modela adaptación fisiológica ni DLMO',
    },
    uncertainty: {
      type: 'worst_case_input_timing_scenario',
      assumption: `cada midpoint puede desplazarse ±${uncertaintyMin.toFixed(0)} min por redondeo/autorreporte`,
      low_hours: round4(Math.max(0.0, sjl - sjlDeltaH)),
      high_hours: round4(Math.min(12.0, sjl + sjlDeltaH)),
    },
    warnings,
    methodology: {
      primary_metric: 'absolute circular difference between MSF and MSW',
      backup_metric:
        'Jankowski sleep-corrected SJL with shorter circular interval; disputed, sensitivity only',
      msfsc_role: 'chronotype proxy only; not used as the primary SJL metric',
      planner: 'deterministic schedule simulation preserving observed sleep durations',
    },
  };
}
