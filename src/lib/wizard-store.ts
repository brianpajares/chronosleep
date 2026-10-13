'use client';

import { useSyncExternalStore } from 'react';
import { addMinutesToTime, type CalculationResult, type Direction, type Inputs } from '@/domain/chronosleep';

/**
 * Wizard session state: kept only in `sessionStorage` (2 h TTL), never in the URL (UX §9/§11:
 * no email or schedules in URLs). Locale-independent, so switching language keeps every answer.
 */

export type Field = keyof Inputs;
export type PartialInputs = Partial<Inputs>;

export interface StoredCalculation {
  calculation_id: string;
  model_version: string;
  preview: { social_jetlag_hours: number; mid_sleep_work: string; mid_sleep_free: string; direction: Direction };
  domain: CalculationResult;
  /** Inputs used for this calculation (so the preview never drifts from edited answers). */
  inputs: Inputs;
}

export interface StoredLead {
  id: string;
  status: 'requested' | 'awaiting_owner' | 'awaiting_payment' | 'ready';
  mode: 'validation' | 'stripe';
}

export interface WizardState {
  v: 1;
  inputs: PartialInputs;
  /** Fields the user has actively confirmed (defaults count only once confirmed). */
  confirmed: Partial<Record<Field, true>>;
  startedAt: number | null;
  stepStartedAt: number | null;
  calculation: StoredCalculation | null;
  lead: StoredLead | null;
  expiresAt: number;
}

const KEY = 'cs_wizard_v1';
const TTL_MS = 2 * 60 * 60 * 1000;

const EMPTY: WizardState = {
  v: 1,
  inputs: {},
  confirmed: {},
  startedAt: null,
  stepStartedAt: null,
  calculation: null,
  lead: null,
  expiresAt: 0,
};

let current: WizardState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load(): void {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as WizardState;
    if (parsed.v === 1 && parsed.expiresAt > Date.now()) current = parsed;
    else window.sessionStorage.removeItem(KEY);
  } catch {
    /* corrupted or unavailable storage: start clean */
  }
}

function emit(next: WizardState): void {
  current = { ...next, expiresAt: Date.now() + TTL_MS };
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* storage full/blocked: state still works in memory for this page view */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): WizardState {
  load();
  return current;
}

const getServerSnapshot = (): WizardState => EMPTY;

export const wizard = {
  get: getSnapshot,

  setField<K extends Field>(field: K, value: Inputs[K], opts: { confirm?: boolean } = {}): void {
    const s = getSnapshot();
    emit({
      ...s,
      startedAt: s.startedAt ?? Date.now(),
      inputs: { ...s.inputs, [field]: value },
      confirmed: opts.confirm ? { ...s.confirmed, [field]: true } : s.confirmed,
      // Editing answers invalidates a previous calculation/lead.
      calculation: null,
      lead: null,
    });
  },

  confirm(field: Field): void {
    const s = getSnapshot();
    emit({ ...s, confirmed: { ...s.confirmed, [field]: true } });
  },

  markStepStart(): void {
    const s = getSnapshot();
    emit({ ...s, startedAt: s.startedAt ?? Date.now(), stepStartedAt: Date.now() });
  },

  setCalculation(calculation: StoredCalculation): void {
    emit({ ...getSnapshot(), calculation, lead: null });
  },

  setLead(lead: StoredLead): void {
    emit({ ...getSnapshot(), lead });
  },

  reset(): void {
    emit({ ...EMPTY });
  },
};

export function useWizard(): WizardState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Inputs with the UX defaults applied (step 3 = step 1, step 4 = step 2 + 60 min, latency 15, ...). */
export function effectiveInputs(s: WizardState): PartialInputs {
  const i = s.inputs;
  const out: PartialInputs = { ...i };
  if (i.work_bedtime && out.free_bedtime === undefined) out.free_bedtime = i.work_bedtime;
  if (i.work_wake_time && out.free_wake_time === undefined) out.free_wake_time = addMinutesToTime(i.work_wake_time, 60);
  if (out.sleep_latency_min === undefined) out.sleep_latency_min = 15;
  if (out.workdays_per_week === undefined) out.workdays_per_week = 5;
  if (out.wake_flexibility_min === undefined) out.wake_flexibility_min = 0;
  return out;
}

export const STEP_FIELDS: readonly Field[] = [
  'work_bedtime',
  'work_wake_time',
  'free_bedtime',
  'free_wake_time',
  'sleep_latency_min',
  'workdays_per_week',
  'free_day_alarm',
  'wake_flexibility_min',
] as const;

/** Complete, valid-shaped inputs or null if something is still missing. */
export function completeInputs(s: WizardState): Inputs | null {
  const e = effectiveInputs(s);
  if (
    e.work_bedtime === undefined ||
    e.work_wake_time === undefined ||
    e.free_bedtime === undefined ||
    e.free_wake_time === undefined ||
    e.free_day_alarm === undefined
  ) {
    return null;
  }
  return e as Inputs;
}

/** First step (1-based) whose required field is still missing; null when the questionnaire is complete. */
export function firstIncompleteStep(s: WizardState): number | null {
  const e = effectiveInputs(s);
  const need: Field[] = ['work_bedtime', 'work_wake_time', 'free_day_alarm'];
  for (const f of need) if (e[f] === undefined) return STEP_FIELDS.indexOf(f) + 1;
  return null;
}
