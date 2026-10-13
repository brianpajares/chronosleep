'use client';

import { ArrowRight, Pencil } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Callout, Card, Eyebrow } from '@/components/ui/primitives';
import {
  deriveInsight,
  deriveWarnings,
  directionOf,
  formatClock,
  formatHoursMinutes,
  formatMinutes,
  populationBands,
  sjlBand,
  type FormatLocale,
} from '@/domain/chronosleep';
import { Link } from '@/i18n/navigation';
import { track } from '@/lib/analytics';
import { useCountUp, useHydrated } from '@/lib/hooks';
import { useWizard } from '@/lib/wizard-store';
import { ScheduleTimeline24h } from './ScheduleTimeline24h';
import { LockedReportCard, ReferenceBandChart, SensitivityRange } from './ResultParts';

function NoState() {
  const t = useTranslations('result');
  return (
    <div className="container-form py-20 text-center">
      <h1 className="text-3xl font-extrabold">{t('no_state_title')}</h1>
      <p className="mt-3 text-lg text-muted">{t('no_state_body')}</p>
      <Button asChild size="lg" className="mt-8">
        <Link href="/calcular/1">{t('no_state_cta')}</Link>
      </Button>
    </div>
  );
}

/** /resultado — value before the gate: figure, direction, timeline, sensitivity, reference, teaser. */
export function ResultView() {
  const hydrated = useHydrated();
  const state = useWizard();
  const calc = state.calculation;
  if (!hydrated) return <div className="container-page min-h-[60vh]" aria-busy="true" />;
  if (!calc) return <NoState />;
  return <Loaded key={calc.calculation_id} calc={calc} />;
}

function Loaded({ calc }: { calc: NonNullable<ReturnType<typeof useWizard>['calculation']> }) {
  const t = useTranslations();
  const locale = useLocale() as FormatLocale;
  const c = calc.domain.current;
  const sjl = c.social_jetlag_hours;
  const animated = useCountUp(sjl);
  const direction = directionOf(c.social_jetlag_relative_hours);
  const insight = deriveInsight(calc.inputs, calc.domain);
  const warnings = deriveWarnings(calc.domain);
  const day1 = calc.domain.plan.schedule_7d[0]!;
  const pct = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
  const gapText = formatHoursMinutes(sjl);
  const band = sjlBand(sjl);

  useEffect(() => {
    track('preview_view', { sjl_band: band, direction, has_msfsc: c.msf_sc !== null, warning_count: warnings.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per calculation
  }, []);

  const insightText = (() => {
    const wake = formatMinutes(insight.wake_diff_min);
    const bed = formatMinutes(insight.bed_diff_min);
    const dir = insight.direction;
    const base =
      insight.key === 'aligned'
        ? t('result.insight_aligned')
        : insight.key === 'wake_dominant'
          ? t('result.insight_wake', { wake, direction: dir })
          : insight.key === 'bed_dominant'
            ? t('result.insight_bed', { bed, direction: dir })
            : t('result.insight_both', { bed, wake, direction: dir });
    return insight.alarm_note ? `${base} ${t('result.insight_alarm')}` : base;
  })();

  const warningText = (code: string, hours?: number) =>
    t(`result.warnings.${code}`, { hours: formatHoursMinutes(hours ?? 0) });

  return (
    <div className="container-page py-10 lg:py-14">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-start">
        <div className="space-y-6">
          <section aria-labelledby="result-title" className="animate-rise">
            <Eyebrow>{t('preview.title')}</Eyebrow>
            <h1 id="result-title" className="mt-2 flex flex-wrap items-baseline gap-x-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              <span aria-hidden="true" className="text-6xl text-primary tabular-nums sm:text-7xl">
                {formatHoursMinutes(animated)}
              </span>
              <span className="sr-only">{`${t('preview.title')}: ${gapText}`}</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg">
              {direction === 'later'
                ? t('preview.direction_later')
                : direction === 'earlier'
                  ? t('preview.direction_earlier')
                  : t('preview.direction_same')}
            </p>
            <p className="mt-3 max-w-xl text-muted">{insightText}</p>
          </section>

          <Card className="p-5 sm:p-6">
            <ScheduleTimeline24h
              work={{ sleepStart: c.sleep_onset_work, wake: calc.inputs.work_wake_time, mid: c.mid_sleep_work }}
              free={{ sleepStart: c.sleep_onset_free, wake: calc.inputs.free_wake_time, mid: c.mid_sleep_free }}
              gapText={gapText}
              locale={locale}
              idPrefix="result"
              animate
              labels={{
                work: t('result.timeline_work'),
                free: t('result.timeline_free'),
                mid: t('result.timeline_mid'),
                gap: t('result.gap_label'),
                scale: t('result.timeline_scale'),
                title: t('result.timeline_title'),
                alt: t('result.timeline_alt', {
                  workStart: formatClock(c.sleep_onset_work, locale),
                  workEnd: formatClock(calc.inputs.work_wake_time, locale),
                  workMid: formatClock(c.mid_sleep_work, locale),
                  freeStart: formatClock(c.sleep_onset_free, locale),
                  freeEnd: formatClock(calc.inputs.free_wake_time, locale),
                  freeMid: formatClock(c.mid_sleep_free, locale),
                  gap: gapText,
                }),
                patternNote: t('result.pattern_note'),
              }}
            />
          </Card>

          <Card className="p-5 sm:p-6">
            <SensitivityRange
              low={calc.domain.uncertainty.low_hours}
              center={sjl}
              high={calc.domain.uncertainty.high_hours}
              labels={{
                title: t('result.sensitivity_title'),
                tooltip: t('result.sensitivity_tooltip'),
                low: t('result.sensitivity_low'),
                center: t('result.sensitivity_center'),
                high: t('result.sensitivity_high'),
                scale: t('result.sensitivity_scale'),
                note: `${t('preview.sensitivity', {
                  min: formatHoursMinutes(calc.domain.uncertainty.low_hours),
                  max: formatHoursMinutes(calc.domain.uncertainty.high_hours),
                })} ${t('preview.sensitivity_note')}`,
              }}
            />
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="mb-3 text-lg font-semibold">{t('result.reference_title')}</h2>
            <ReferenceBandChart
              bands={populationBands()}
              current={c.reference_band}
              you={t('result.reference_you')}
              percent={(share) => pct.format(share)}
              labels={{
                menos_de_1h: t('result.reference_lt1'),
                '1h_a_menos_de_2h': t('result.reference_1_2'),
                '2h_o_mas': t('result.reference_ge2'),
              }}
            />
            <p className="mt-3 text-sm text-muted">
              {t('preview.population')} {t('result.reference_caption')}
            </p>
          </Card>

          {warnings.map((w) => (
            <Callout
              key={w.code}
              tone={w.code === 'sjl_very_high' || w.code === 'sleep_very_long' ? 'warning' : 'info'}
              title={w.code === 'sjl_very_high' || w.code === 'sleep_very_long' ? t('result.warning_attention') : t('result.warning_info')}
            >
              {warningText(w.code, w.value_hours)}
            </Callout>
          ))}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24" aria-label={t('gate.what_title')}>
          <LockedReportCard
            title={t('preview.locked_plan')}
            lockedLabel={t('preview.locked_label')}
            visibleLabel={t('result.locked_visible')}
            rest={t('result.locked_plan_rest')}
          >
            {t('result.locked_plan_day1', { bed: formatClock(day1.bedtime, locale), wake: formatClock(day1.wake_time, locale) })}
          </LockedReportCard>
          <LockedReportCard
            title={t('preview.locked_scenario')}
            lockedLabel={t('preview.locked_label')}
            visibleLabel={t('result.locked_visible')}
            rest={t('result.locked_scenario_delta')}
          >
            {t('result.locked_scenario_hint')}
          </LockedReportCard>
          <LockedReportCard
            title={t('preview.locked_method')}
            lockedLabel={t('preview.locked_label')}
            visibleLabel={t('result.locked_visible')}
          >
            <ol className="list-decimal space-y-1 pl-5">
              {(t.raw('result.locked_method_items') as string[]).map((item, i) => (
                <li key={item} className={i === 0 ? '' : 'text-muted'}>
                  {i === 0 ? item : <span className="inline-block h-3 w-3/4 rounded bg-line align-middle" aria-hidden="true" />}
                  {i === 0 ? null : <span className="sr-only">{t('preview.locked_label')}</span>}
                </li>
              ))}
            </ol>
          </LockedReportCard>

          <div className="space-y-3 pt-2">
            <Button asChild size="lg" block>
              <Link
                href="/informe/solicitar"
                onClick={() => track('preview_report_cta', { phase: 'validation', sjl_band: band })}
              >
                {t('preview.cta')}
                <ArrowRight aria-hidden="true" className="size-5" />
              </Link>
            </Button>
            <p className="text-center text-sm text-muted">{t('result.cta_note')}</p>
            <p className="text-center text-xs text-muted">{t('preview.disclaimer')}</p>
            <p className="flex flex-wrap justify-center gap-x-5 text-sm">
              <Link
                href="/como-funciona"
                onClick={() => track('methodology_opened', { from: 'preview' })}
                className="inline-flex min-h-11 items-center"
              >
                {t('preview.method_link')}
              </Link>
              <Link href="/legal/privacidad" className="inline-flex min-h-11 items-center">
                {t('preview.privacy_link')}
              </Link>
              <Link href="/calcular/1" className="inline-flex min-h-11 items-center gap-1">
                <Pencil aria-hidden="true" className="size-4" />
                {t('wizard.review_edit')}
              </Link>
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
