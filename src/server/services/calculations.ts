import 'server-only';
import { randomUUID } from 'node:crypto';
import {
  calculate,
  directionOf,
  EngineError,
  InputsSchema,
  sjlBand,
  type CalculationResult,
  type Direction,
  type Inputs,
} from '@/domain/chronosleep';
import { ApiError } from '../api';
import { openPair, sealPair } from '../crypto';
import { getEngineParams } from '../drive';
import { env } from '../env';
import { getStore, type CalculationRow, type Locale } from '../store';

export interface CalculateResponse {
  calculation_id: string;
  model_version: string;
  preview: {
    social_jetlag_hours: number;
    mid_sleep_work: string;
    mid_sleep_free: string;
    direction: Direction;
  };
  domain: CalculationResult;
  request_id: string;
}

const DAY_MS = 86_400_000;

/** FR-03/FR-04: validate against the shared contract, run the pure engine, persist ciphertext only. */
export async function createCalculation(args: {
  inputs: unknown;
  locale: Locale;
  requestId: string;
}): Promise<CalculateResponse> {
  const parsed = InputsSchema.parse(args.inputs);
  const { params } = await getEngineParams();

  let result: CalculationResult;
  try {
    result = calculate(parsed, params);
  } catch (e) {
    if (e instanceof EngineError) {
      throw new ApiError(400, e.code, e.message, { field: e.field, hours: e.hours });
    }
    throw e;
  }

  const id = randomUUID();
  const now = Date.now();
  const sealed = sealPair(parsed, result, id);
  const row: CalculationRow = {
    id,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + env.retention().calculationDays * DAY_MS).toISOString(),
    locale: args.locale,
    model_version: result.model_version,
    ...sealed,
    sjl_band: sjlBand(result.current.social_jetlag_hours),
    warning_count: result.warnings.length,
    request_id: args.requestId,
    deleted_at: null,
  };
  await getStore().insertCalculation(row);

  return {
    calculation_id: id,
    model_version: result.model_version,
    preview: {
      social_jetlag_hours: result.current.social_jetlag_hours,
      mid_sleep_work: result.current.mid_sleep_work,
      mid_sleep_free: result.current.mid_sleep_free,
      direction: directionOf(result.current.social_jetlag_relative_hours),
    },
    domain: result,
    request_id: args.requestId,
  };
}

export interface LoadedCalculation {
  row: CalculationRow;
  inputs: Inputs;
  result: CalculationResult;
}

export async function loadCalculation(id: string): Promise<LoadedCalculation | null> {
  const row = await getStore().getCalculation(id);
  if (!row || row.deleted_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  const { inputs, result } = openPair<Inputs, CalculationResult>(row, id);
  return { row, inputs, result };
}
