'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/primitives';
import { sjlBand } from '@/domain/chronosleep';
import { Link, useRouter } from '@/i18n/navigation';
import { track } from '@/lib/analytics';
import { bucketComputeMs } from '@/lib/analytics-catalog';
import { completeInputs, firstIncompleteStep, wizard, type StoredCalculation } from '@/lib/wizard-store';

type Fail = { code: string; hours?: number; step: number };

function stepForError(code: string, field?: string): number {
  if (code === 'sleep_duration_work') return 2;
  if (code === 'sleep_duration_free') return 4;
  const order = ['work_bedtime', 'work_wake_time', 'free_bedtime', 'free_wake_time', 'sleep_latency_min', 'workdays_per_week', 'free_day_alarm', 'wake_flexibility_min'];
  const i = field ? order.indexOf(field) : -1;
  return i >= 0 ? i + 1 : 8;
}

/** /procesando — runs the engine (server-side API), explains what is happening, never waits artificially > ~500 ms. */
export function Processing() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const ran = useRef(false);
  const [fail, setFail] = useState<Fail | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const s = wizard.get();
    const inputs = completeInputs(s);
    if (!inputs) {
      router.replace(`/calcular/${firstIncompleteStep(s) ?? 1}`);
      return;
    }
    // Reuse a calculation that already matches these answers (e.g. language switch on this page).
    if (s.calculation && JSON.stringify(s.calculation.inputs) === JSON.stringify(inputs)) {
      router.replace('/resultado');
      return;
    }

    const modelVersion = 'chronosleep-sjl-2.0';
    track('calculation_started', { model_version: modelVersion });
    const started = performance.now();
    const minimum = new Promise((r) => setTimeout(r, 420));

    (async () => {
      try {
        const res = await fetch('/api/calculate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ inputs, locale }),
        });
        const body = (await res.json()) as Record<string, unknown>;
        await minimum;
        if (!res.ok) {
          const code = String(body.code ?? 'error');
          track('calculation_failed', { model_version: modelVersion, error_code: code });
          setFail({ code, hours: typeof body.hours === 'number' ? body.hours : undefined, step: stepForError(code, body.field as string | undefined) });
          return;
        }
        const calc = body as unknown as Omit<StoredCalculation, 'inputs'>;
        wizard.setCalculation({ ...calc, inputs });
        track('calculation_succeeded', {
          model_version: calc.model_version,
          sjl_band: sjlBand(calc.domain.current.social_jetlag_hours),
          warning_count: calc.domain.warnings.length,
          compute_ms_bucket: bucketComputeMs(performance.now() - started),
        });
        router.replace('/resultado');
      } catch {
        track('calculation_failed', { model_version: modelVersion, error_code: 'network' });
        setFail({ code: 'network', step: 8 });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- single run per mount
  }, []);

  if (fail) {
    const durationMsg =
      fail.code === 'sleep_duration_work' || fail.code === 'sleep_duration_free'
        ? t(`errors.${fail.code}`, { hours: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(fail.hours ?? 0) })
        : null;
    return (
      <div className="container-form py-16">
        <Card className="p-6 sm:p-8">
          <div role="alert">
            <h1 className="text-2xl font-bold">{t('processing.error')}</h1>
            {durationMsg ? <p className="mt-3 text-muted">{durationMsg}</p> : null}
            {fail.code === 'network' ? <p className="mt-3 text-muted">{t('errors.network')}</p> : null}
            {fail.code === 'rate_limited' ? <p className="mt-3 text-muted">{t('errors.rate_limited')}</p> : null}
          </div>
          <Button asChild size="lg" className="mt-6">
            <Link href={`/calcular/${fail.step}`}>{t('processing.error_cta')}</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container-form py-20 text-center">
      <div aria-live="polite" role="status">
        <h1 className="text-3xl font-extrabold tracking-tight">{t('processing.title')}</h1>
        <p className="mx-auto mt-4 max-w-md text-lg text-muted">{t('processing.body')}</p>
      </div>
      {/* Two bars sliding toward each other; static under prefers-reduced-motion. */}
      <div aria-hidden="true" className="mx-auto mt-10 w-full max-w-sm space-y-3">
        <div className="h-4 overflow-hidden rounded-full bg-subtle">
          <div className="hatch h-full w-1/2 animate-pulse-soft rounded-full" />
        </div>
        <div className="h-4 overflow-hidden rounded-full bg-subtle">
          <div className="ml-auto h-full w-2/5 animate-pulse-soft rounded-full bg-primary [animation-delay:400ms]" />
        </div>
      </div>
    </div>
  );
}
