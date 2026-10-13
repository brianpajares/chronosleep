'use client';

import { Check, Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState, type ReactNode } from 'react';
import { addMinutesToTime } from '@/domain/chronosleep';
import { Input, Label } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

interface Describe {
  /** ids of helper/error elements, wired through aria-describedby. */
  describedBy?: string;
  invalid?: boolean;
}

/* ------------------------------------------------------------------ Segmented */

export function Segmented<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  columns = 'auto',
  large = false,
  describedBy,
}: {
  name: string;
  legend: string;
  options: { value: T; label: ReactNode }[];
  value: T | null;
  onChange: (v: T) => void;
  columns?: 'auto' | 2;
  large?: boolean;
  describedBy?: string;
}) {
  return (
    <fieldset aria-describedby={describedBy}>
      <legend className="sr-only">{legend}</legend>
      <div className={cn('grid gap-3', columns === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-5')}>
        {options.map((o) => {
          const checked = o.value === value;
          return (
            <label key={o.value} className="relative block">
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={checked}
                onChange={() => onChange(o.value)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-md border-2 px-4 text-center font-semibold transition-colors',
                  large ? 'min-h-16 text-xl' : 'min-h-12 text-base',
                  checked
                    ? 'border-primary bg-primary text-on-primary shadow-sm'
                    : 'border-line-strong bg-surface text-fg hover:border-primary',
                  'peer-focus-visible:shadow-[var(--focus-ring)] peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus',
                )}
              >
                {checked ? <Check aria-hidden="true" className="size-5 shrink-0" /> : null}
                {o.label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/* ------------------------------------------------------------------ TimeInput */

export function TimeField({
  id,
  label,
  value,
  seed,
  onChange,
  describedBy,
  invalid,
}: {
  id: string;
  label: string;
  value: string | undefined;
  /** Where the quick-adjust buttons start when the field is empty. */
  seed: string;
  onChange: (v: string) => void;
} & Describe) {
  const t = useTranslations('wizard');
  const hintId = `${id}-hint`;
  const nudge = (delta: number) => onChange(addMinutesToTime(value && /^\d{2}:\d{2}$/.test(value) ? value : seed, delta));
  const btn =
    'inline-flex min-h-11 min-w-16 items-center justify-center gap-1 rounded-md border border-line-strong bg-surface px-3 text-sm font-semibold hover:border-primary hover:bg-subtle';

  return (
    <div className="space-y-3">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="time"
        step={60}
        required
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={[describedBy, hintId].filter(Boolean).join(' ') || undefined}
        className="h-16 text-center text-3xl font-bold tabular-nums tracking-wide"
      />
      <p id={hintId} className="text-sm text-muted">
        {t('time_hint', { example: t('time_example') })}
      </p>
      <div role="group" aria-label={t('nudge_label')} className="flex flex-wrap gap-2">
        <button type="button" className={btn} onClick={() => nudge(-15)} aria-label={t('nudge_earlier')}>
          <Minus aria-hidden="true" className="size-4" />
          15
        </button>
        <button type="button" className={btn} onClick={() => nudge(15)} aria-label={t('nudge_later')}>
          <Plus aria-hidden="true" className="size-4" />
          15
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ NumericInput */

export function NumberField({
  id,
  label,
  raw,
  onRaw,
  min,
  max,
  unit,
  describedBy,
  invalid,
  className,
  hideLabel,
}: {
  id: string;
  label: string;
  raw: string;
  onRaw: (raw: string) => void;
  min: number;
  max: number;
  unit?: string;
  hideLabel?: boolean;
  className?: string;
} & Describe) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id} className={hideLabel ? 'sr-only' : undefined}>
        {label}
      </Label>
      <div className="flex items-center gap-3">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          step={1}
          min={min}
          max={max}
          value={raw}
          onChange={(e) => onRaw(e.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className="h-14 max-w-40 text-center text-2xl font-bold tabular-nums"
        />
        {unit ? <span className="text-lg font-semibold text-muted">{unit}</span> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Latency (presets + other) */

const PRESETS = [0, 10, 15, 30] as const;

export function LatencyField({
  raw,
  onRaw,
  describedBy,
  invalid,
}: {
  raw: string;
  onRaw: (raw: string) => void;
} & Describe) {
  const t = useTranslations('wizard');
  const s = useTranslations('steps.sleep_latency_min');
  const [otherForced, setOtherForced] = useState(false);
  const n = raw.trim() === '' ? NaN : Number(raw);
  const isPreset = Number.isInteger(n) && (PRESETS as readonly number[]).includes(n);
  const selected: string = isPreset && !otherForced ? String(n) : 'other';

  return (
    <div className="space-y-5">
      <Segmented
        name="latency"
        legend={t('latency_group')}
        value={selected}
        describedBy={describedBy}
        onChange={(v) => {
          if (v === 'other') {
            setOtherForced(true);
            if (isPreset) onRaw('');
          } else {
            setOtherForced(false);
            onRaw(v);
          }
        }}
        options={[
          ...PRESETS.map((p) => ({ value: String(p), label: t('latency_preset', { min: p }) })),
          { value: 'other', label: t('latency_other') },
        ]}
      />
      {selected === 'other' ? (
        <NumberField
          id="latency-other"
          label={t('latency_other_label')}
          raw={raw}
          onRaw={onRaw}
          min={0}
          max={120}
          unit={s('unit')}
          describedBy={describedBy}
          invalid={invalid}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Stepper 1–6 */

export function WorkdaysField({
  raw,
  onRaw,
  describedBy,
  invalid,
}: {
  raw: string;
  onRaw: (raw: string) => void;
} & Describe) {
  const t = useTranslations('wizard');
  const s = useTranslations('steps.workdays_per_week');
  const id = useId();
  const n = Number(raw);
  const valid = Number.isInteger(n) && n >= 1 && n <= 6;
  const bump = (d: number) => onRaw(String(Math.min(6, Math.max(1, (valid ? n : 5) + d))));
  const btn =
    'inline-flex size-14 items-center justify-center rounded-full border-2 border-line-strong bg-surface text-fg hover:border-primary hover:bg-subtle disabled:opacity-40';

  return (
    <div className="space-y-4">
      <Label htmlFor={`${id}-n`}>{t('fields.workdays_per_week.label')}</Label>
      <div className="flex items-center gap-4">
        <button type="button" className={btn} onClick={() => bump(-1)} disabled={valid && n <= 1} aria-label={t('workdays_decrease')}>
          <Minus aria-hidden="true" className="size-6" />
        </button>
        <Input
          id={`${id}-n`}
          type="number"
          inputMode="numeric"
          min={1}
          max={6}
          step={1}
          value={raw}
          onChange={(e) => onRaw(e.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className="h-16 w-24 text-center text-4xl font-extrabold tabular-nums"
        />
        <button type="button" className={btn} onClick={() => bump(1)} disabled={valid && n >= 6} aria-label={t('workdays_increase')}>
          <Plus aria-hidden="true" className="size-6" />
        </button>
        <span className="text-lg font-semibold text-muted">{s('unit')}</span>
      </div>
      {valid ? <p className="text-sm text-muted">{t('workdays_free', { free: 7 - n })}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Slider + number (0–120) */

export function FlexField({
  raw,
  onRaw,
  describedBy,
  invalid,
}: {
  raw: string;
  onRaw: (raw: string) => void;
} & Describe) {
  const t = useTranslations('wizard');
  const s = useTranslations('steps.wake_flexibility_min');
  const n = Number(raw);
  const sliderValue = Number.isFinite(n) ? Math.min(120, Math.max(0, Math.round(n))) : 0;
  const pct = (sliderValue / 120) * 100;

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <Label htmlFor="flex-range">{t('flex_slider')}</Label>
          <output htmlFor="flex-range" className="text-2xl font-extrabold tabular-nums text-primary">
            {t('flex_value', { min: sliderValue })}
          </output>
        </div>
        <input
          id="flex-range"
          type="range"
          min={0}
          max={120}
          step={1}
          value={sliderValue}
          onChange={(e) => onRaw(e.target.value)}
          aria-describedby={describedBy}
          aria-valuetext={t('flex_value', { min: sliderValue })}
          className="h-11 w-full"
          style={{
            background: `linear-gradient(to right, var(--primary) ${pct}%, var(--surface-subtle) ${pct}%) center / 100% 8px no-repeat`,
          }}
        />
        <div aria-hidden="true" className="mt-1 flex justify-between text-xs text-muted tabular-nums">
          {[0, 30, 60, 90, 120].map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
        <span className="sr-only">{t('flex_marks')}</span>
      </div>
      <NumberField
        id="flex-number"
        label={t('flex_number')}
        raw={raw}
        onRaw={onRaw}
        min={0}
        max={120}
        unit={s('unit')}
        describedBy={describedBy}
        invalid={invalid}
      />
      {sliderValue === 0 && raw !== '' ? <p className="text-sm text-muted">{t('flex_none')}</p> : null}
    </div>
  );
}
