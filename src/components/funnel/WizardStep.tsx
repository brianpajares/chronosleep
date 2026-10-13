'use client';

import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, FieldError, Helper } from '@/components/ui/primitives';
import { episodeHours, TIME_RE, type Inputs } from '@/domain/chronosleep';
import { Link, useRouter } from '@/i18n/navigation';
import { track } from '@/lib/analytics';
import { bucketElapsedMs, bucketMinutes } from '@/lib/analytics-catalog';
import { effectiveInputs, STEP_FIELDS, useWizard, wizard, type Field } from '@/lib/wizard-store';
import { cn } from '@/lib/utils';
import { AlarmFieldControl } from './AlarmField';
import { FlexField, LatencyField, TimeField, WorkdaysField } from './fields';

const TOTAL = 8;
const TIME_SEEDS: Record<string, string> = {
  work_bedtime: '23:00',
  work_wake_time: '07:00',
  free_bedtime: '00:00',
  free_wake_time: '08:00',
};

type Err = { code: string; message: string } | null;

function Progress({ step }: { step: number }) {
  const t = useTranslations();
  const text = t('progress', { current: step, total: TOTAL });
  return (
    <div role="progressbar" aria-valuemin={1} aria-valuemax={TOTAL} aria-valuenow={step} aria-valuetext={text} aria-label={text}>
      <p className="mb-2 text-sm font-semibold text-muted">{text}</p>
      <div className="flex gap-1.5" aria-hidden="true">
        {Array.from({ length: TOTAL }, (_, i) => (
          <span
            key={i}
            className={cn('h-2 flex-1 rounded-full transition-colors', i < step ? 'bg-primary' : 'bg-line')}
          />
        ))}
      </div>
    </div>
  );
}

export function WizardStep({ step }: { step: number }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const state = useWizard();
  const field = STEP_FIELDS[step - 1] as Field;
  const eff = effectiveInputs(state);
  const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

  // `draft` holds what the user typed (including invalid text); null means "follow the store".
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<Err>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const stored = eff[field];
  const raw = draft ?? (stored === undefined || stored === null ? '' : String(stored));
  const errorId = `${field}-error`;
  const helperId = `${field}-helper`;
  const describedBy = [helperId, error ? errorId : null].filter(Boolean).join(' ');

  useEffect(() => {
    // Route guard: answers without defaults must exist before this step (read straight from storage).
    const s = effectiveInputs(wizard.get());
    const required: Field[] = ['work_bedtime', 'work_wake_time', 'free_day_alarm'];
    const missing = required.find((f) => STEP_FIELDS.indexOf(f) < step - 1 && s[f] === undefined);
    if (missing) {
      router.replace(`/calcular/${STEP_FIELDS.indexOf(missing) + 1}`);
      return;
    }
    wizard.markStepStart();
    track('step_view', { step, field, locale });
    headingRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per step view
  }, [step]);

  const focusControl = () => {
    const el = formRef.current?.querySelector<HTMLElement>('input:not([type=radio]):not([type=range]), input[type=radio]:checked, input[type=radio]');
    el?.focus();
  };

  const fail = (code: string, message: string): null => {
    setError({ code, message });
    track('validation_error', { step, field, error_code: code });
    setTimeout(focusControl, 0);
    return null;
  };

  const durationError = (candidate: Partial<Inputs>): string | null => {
    const e = { ...eff, ...candidate };
    const lat = e.sleep_latency_min ?? 15;
    const check = (which: 'work' | 'free') => {
      const h = which === 'work' ? episodeHours(e.work_bedtime, e.work_wake_time, lat) : episodeHours(e.free_bedtime, e.free_wake_time, lat);
      return h !== null && (h < 3 || h > 14) ? h : null;
    };
    let bad: number | null = null;
    if (step === 2) bad = check('work');
    else if (step === 3 || step === 4) bad = check('free');
    else if (step >= 5) bad = check('work') ?? check('free');
    return bad === null ? null : t('errors.sleep_duration', { hours: num.format(bad) });
  };

  /** Validates the current raw value; returns the typed value or null (after showing the error). */
  const validate = (): Partial<Inputs> | null => {
    switch (field) {
      case 'work_bedtime':
      case 'work_wake_time':
      case 'free_bedtime':
      case 'free_wake_time': {
        if (!raw) return fail('required', t('errors.required'));
        if (!TIME_RE.test(raw)) return fail('time', t('errors.time'));
        const d = durationError({ [field]: raw } as Partial<Inputs>);
        if (d) return fail('sleep_duration', d);
        return { [field]: raw } as Partial<Inputs>;
      }
      case 'sleep_latency_min': {
        const n = Number(raw);
        if (raw.trim() === '') return fail('required', t('errors.required'));
        if (!Number.isInteger(n)) return fail('integer', t('errors.integer'));
        if (n < 0 || n > 120) return fail('latency_range', t('errors.latency_range'));
        const d = durationError({ sleep_latency_min: n });
        if (d) return fail('sleep_duration', d);
        return { sleep_latency_min: n };
      }
      case 'workdays_per_week': {
        const n = Number(raw);
        if (raw.trim() === '') return fail('required', t('errors.required'));
        if (!Number.isInteger(n)) return fail('integer', t('errors.integer'));
        if (n < 1 || n > 6) return fail('workdays_range', t('errors.workdays_range'));
        return { workdays_per_week: n };
      }
      case 'free_day_alarm': {
        if (raw !== 'yes' && raw !== 'no') return fail('required', t('errors.required'));
        return { free_day_alarm: raw === 'yes' };
      }
      case 'wake_flexibility_min': {
        const n = Number(raw);
        if (raw.trim() === '') return fail('required', t('errors.required'));
        if (!Number.isInteger(n)) return fail('integer', t('errors.integer'));
        if (n < 0 || n > 120) return fail('flex_range', t('errors.flex_range'));
        const d = durationError({ wake_flexibility_min: n });
        if (d) return fail('sleep_duration', d);
        return { wake_flexibility_min: n };
      }
    }
  };

  const bucketFor = (f: Field, v: number | string | boolean): string | undefined =>
    (f === 'sleep_latency_min' || f === 'wake_flexibility_min') && typeof v === 'number' ? bucketMinutes(v) : undefined;

  const onRaw = (next: string) => {
    setDraft(next);
    setError(null);
    // Persist valid values immediately so a language switch / reload never loses progress.
    if (TIME_RE.test(next) && /time/.test(field)) {
      wizard.setField(field as 'work_bedtime', next);
      track('input_changed', { field });
    } else if (/_min$|per_week$/.test(field) && next.trim() !== '' && Number.isInteger(Number(next))) {
      wizard.setField(field as 'sleep_latency_min', Number(next));
      track('input_changed', { field, bucket_optional: bucketFor(field, Number(next)) });
    } else if (field === 'free_day_alarm' && (next === 'yes' || next === 'no')) {
      wizard.setField('free_day_alarm', next === 'yes');
      track('input_changed', { field });
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const value = validate();
    if (!value) return;
    const [[k, v]] = Object.entries(value) as [[Field, Inputs[Field]]];
    wizard.setField(k as 'work_bedtime', v as string, { confirm: true });
    const started = wizard.get().stepStartedAt ?? Date.now();
    track('step_complete', { step, field, elapsed_ms_bucket: bucketElapsedMs(Date.now() - started) });
    router.push(step === TOTAL ? '/procesando' : `/calcular/${step + 1}`);
  };

  const hasValue = raw !== '';
  const disabledBeforeInteraction = (field === 'work_bedtime' || field === 'work_wake_time' || field === 'free_day_alarm') && !hasValue;
  const lat = eff.sleep_latency_min ?? 15;
  const workH = episodeHours(eff.work_bedtime, eff.work_wake_time, lat);
  const freeH = episodeHours(eff.free_bedtime, eff.free_wake_time, lat);

  const control = (() => {
    switch (field) {
      case 'work_bedtime':
      case 'work_wake_time':
      case 'free_bedtime':
      case 'free_wake_time':
        return (
          <TimeField
            id={field}
            label={t(`wizard.fields.${field}.label`)}
            value={raw}
            seed={TIME_SEEDS[field] as string}
            onChange={onRaw}
            describedBy={describedBy}
            invalid={Boolean(error)}
          />
        );
      case 'sleep_latency_min':
        return <LatencyField raw={raw} onRaw={onRaw} describedBy={describedBy} invalid={Boolean(error)} />;
      case 'workdays_per_week':
        return <WorkdaysField raw={raw} onRaw={onRaw} describedBy={describedBy} invalid={Boolean(error)} />;
      case 'free_day_alarm':
        return (
          <AlarmFieldControl
            value={raw === 'yes' || raw === 'no' ? raw : null}
            onChange={onRaw}
            describedBy={describedBy}
          />
        );
      case 'wake_flexibility_min':
        return <FlexField raw={raw} onRaw={onRaw} describedBy={describedBy} invalid={Boolean(error)} />;
    }
  })();

  const back = (
    <Link
      href={step === 1 ? '/' : `/calcular/${step - 1}`}
      onClick={() => track('calculator_back', { from_step: step, to_step: Math.max(0, step - 1) })}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-4 font-semibold text-fg no-underline hover:bg-subtle"
    >
      <ArrowLeft aria-hidden="true" className="size-5" />
      {t('common.back')}
    </Link>
  );

  return (
    <div className="container-form py-8 sm:py-12">
      <Progress step={step} />
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-8 text-3xl font-extrabold tracking-tight outline-none sm:text-4xl"
      >
        {t(`steps.${field}.title`)}
      </h1>
      <Helper id={helperId} className="mt-3 text-base">
        {t(`steps.${field}.helper`)}
      </Helper>

      <Card className="mt-8 p-5 sm:p-8">
        <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-6">
          <noscript>
            <p className="text-danger">{t('site.nojs')}</p>
          </noscript>
          {control}
          <FieldError id={errorId}>{error?.message}</FieldError>

          {(step === 4 || step === 5) && workH !== null && freeH !== null && !error ? (
            <p className="rounded-md bg-subtle px-4 py-3 text-sm text-muted" aria-live="polite">
              {t('wizard.duration_work_hint', { hours: num.format(workH) })} · {t('wizard.duration_free_hint', { hours: num.format(freeH) })}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            {back}
            <Button type="submit" size="lg" disabled={disabledBeforeInteraction} className="sm:min-w-56">
              {t(`steps.${field}.cta`)}
              <ArrowRight aria-hidden="true" className="size-5" />
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
