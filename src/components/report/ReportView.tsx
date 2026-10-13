import { getTranslations } from 'next-intl/server';
import { ScheduleTimeline24h } from '@/components/funnel/ScheduleTimeline24h';
import { ReferenceBandChart } from '@/components/funnel/ResultParts';
import { Callout, Card, Eyebrow } from '@/components/ui/primitives';
import {
  directionOf,
  formatClock,
  formatHoursMinutes,
  hoursToMinutes,
  verificationIdFromUuid,
  type EngineParams,
  type FormatLocale,
  type ReportModel,
} from '@/domain/chronosleep';
import { reportHash } from '@/server/pdf/render';
import { ReportActions, WhatIf } from './ReportClient';

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 text-2xl font-bold tracking-tight">
      {children}
    </h2>
  );
}

function Table({ caption, head, rows }: { caption: string; head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-line">
      <table className="w-full min-w-[30rem] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-subtle">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {r.map((c, j) =>
                j === 0 ? (
                  <th key={j} scope="row" className="px-3 py-2 font-semibold">
                    {c}
                  </th>
                ) : (
                  <td key={j} className="px-3 py-2 tabular-nums">
                    {c}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Web report — same ReportModel as the PDF (FR-13/FR-28): every INFORME_COMPLETO output is here. */
export async function ReportView({
  report,
  leadId,
  locale,
  token,
  params,
  generatedAt,
}: {
  report: ReportModel;
  leadId: string;
  locale: FormatLocale;
  token: string;
  params: EngineParams;
  generatedAt: Date;
}) {
  const t = await getTranslations();
  const c = report.result.current;
  const f = report.full;
  const dir = directionOf(c.social_jetlag_relative_hours);
  const cur = formatHoursMinutes(c.social_jetlag_hours);
  const planned = formatHoursMinutes(f.planned_social_jetlag_hours);
  const clock = (s: string) => formatClock(s, locale);
  const dayType = (d: 'work' | 'free') => t(d === 'work' ? 'report.day_work' : 'report.day_free');
  const change = (m: number) =>
    m === 0 ? t('report.plan_change_none') : m > 0 ? t('report.plan_change_later', { min: m }) : t('report.plan_change_earlier', { min: Math.abs(m) });
  const pct = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
  const vid = verificationIdFromUuid(leadId);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(generatedAt);
  const q = `?token=${encodeURIComponent(token)}`;
  const warningText = (w: ReportModel['warnings'][number]) => t(`result.warnings.${w.code}`, { hours: formatHoursMinutes(w.value_hours ?? 0) });
  const max = Math.max(0.25, ...f.scenarios.map((s) => s.sjl_hours));
  const label = (id: string, flex: number | null) =>
    id === 'base'
      ? t('report.scenario_base')
      : id === 'no_flex'
        ? t('report.scenario_no_flex')
        : id === 'current_flex'
          ? t('report.scenario_current_flex', { min: flex ?? 0 })
          : t('report.scenario_more_flex', { min: flex ?? 0 });
  const comp = report.full.drivers[1]!;
  const flexD = report.full.drivers[2]!.detail as Record<string, number>;
  const compMin = Math.abs(comp.minutes);
  const toc = [
    ['summary', t('report.summary')],
    ['meaning', t('report.meaning_title')],
    ['week', t('report.week_title')],
    ['plan', t('report.plan')],
    ['scenarios', t('report.scenarios')],
    ['sensitivity', t('report.sensitivity')],
    ['assumptions', t('report.assumptions')],
    ['method', t('report.methodology')],
  ] as const;

  return (
    <article className="container-report space-y-12 py-10 sm:py-14">
      <header id="summary" className="scroll-mt-24 space-y-5">
        <Eyebrow>{t('report.title')}</Eyebrow>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          <span className="text-primary tabular-nums">{cur}</span>
        </h1>
        <p className="max-w-xl text-lg">
          {dir === 'later' ? t('preview.direction_later') : dir === 'earlier' ? t('preview.direction_earlier') : t('preview.direction_same')}
        </p>
        <p className="text-muted">
          {f.planned_social_jetlag_hours < c.social_jetlag_hours
            ? t('report.summary_change_better', { current: cur, planned })
            : t('report.summary_change_same', { current: cur })}
        </p>
        <p className="text-sm text-muted">
          {t('report.subtitle', { date })} · {t('report.verification_value', { id: vid })} · {t('report.model_label')} {report.model_version} ·{' '}
          {t('report.report_version_label')} {report.report_version}
        </p>
        <ReportActions
          pdfHref={`/api/reports/${leadId}/pdf${q}`}
          icsHref={`/api/reports/${leadId}/ics${q}`}
          modelVersion={report.model_version}
          reportVersion={report.report_version}
        />
        <p className="text-sm text-muted">{t('report.download_pdf_hint')} {t('report.ics_hint')}</p>
        <nav aria-label={t('report.title')} className="no-print flex flex-wrap gap-2 pt-2">
          {toc.map(([id, text]) => (
            <a key={id} href={`#${id}`} className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm font-semibold no-underline hover:bg-subtle">
              {text}
            </a>
          ))}
        </nav>
        {report.warnings.map((w) => (
          <Callout key={w.code} tone={w.code === 'sjl_very_high' || w.code === 'sleep_very_long' ? 'warning' : 'info'} title={t('result.warning_info')}>
            {warningText(w)}
          </Callout>
        ))}
      </header>

      <section aria-labelledby="meaning" className="space-y-4">
        <H2 id="meaning">{t('report.meaning_title')}</H2>
        {(t.raw('report.meaning_paragraphs') as string[]).map((p) => (
          <p key={p}>{p}</p>
        ))}
        <Card className="p-5">
          <ScheduleTimeline24h
            work={{ sleepStart: c.sleep_onset_work, wake: report.inputs.work_wake_time, mid: c.mid_sleep_work }}
            free={{ sleepStart: c.sleep_onset_free, wake: report.inputs.free_wake_time, mid: c.mid_sleep_free }}
            gapText={cur}
            locale={locale}
            idPrefix="report"
            labels={{
              work: t('result.timeline_work'),
              free: t('result.timeline_free'),
              mid: t('result.timeline_mid'),
              gap: t('result.gap_label'),
              scale: t('result.timeline_scale'),
              title: t('result.timeline_title'),
              alt: t('result.timeline_alt', {
                workStart: clock(c.sleep_onset_work),
                workEnd: clock(report.inputs.work_wake_time),
                workMid: clock(c.mid_sleep_work),
                freeStart: clock(c.sleep_onset_free),
                freeEnd: clock(report.inputs.free_wake_time),
                freeMid: clock(c.mid_sleep_free),
                gap: cur,
              }),
              patternNote: t('result.pattern_note'),
            }}
          />
        </Card>
        <p className="text-sm">
          {t('report.meaning_work', { time: clock(c.mid_sleep_work) })} · {t('report.meaning_free', { time: clock(c.mid_sleep_free) })}
        </p>
        <h3 className="text-lg font-semibold">{t('result.reference_title')}</h3>
        <ReportBand report={report} pct={(n) => pct.format(n)} youLabel={t('result.reference_you')} labels={{ menos_de_1h: t('result.reference_lt1'), '1h_a_menos_de_2h': t('result.reference_1_2'), '2h_o_mas': t('result.reference_ge2') }} />
        <p className="text-sm text-muted">{t('report.population_caption')}</p>

        <h3 className="text-lg font-semibold">{t('report.drivers_title')}</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            {dir === 'aligned'
              ? t('report.driver_midpoint_gap_aligned')
              : t(dir === 'later' ? 'report.driver_midpoint_gap_later' : 'report.driver_midpoint_gap_earlier', { value: cur })}
          </li>
          <li>
            {compMin === 0
              ? t('report.driver_compensation_same')
              : t(comp.minutes > 0 ? 'report.driver_compensation_more' : 'report.driver_compensation_less', {
                  value: formatHoursMinutes(hoursToMinutes(compMin / 60) / 60),
                  free: String(c.sleep_duration_free_hours),
                  work: String(c.sleep_duration_work_hours),
                })}
          </li>
          <li>
            {t('report.driver_flexibility', {
              flex: report.full.drivers[2]!.minutes,
              need: formatHoursMinutes((flexD.needed_minutes ?? 0) / 60),
              work: formatHoursMinutes((flexD.work_shift_minutes ?? 0) / 60),
              free: formatHoursMinutes((flexD.free_shift_minutes ?? 0) / 60),
              cap: flexD.free_cap_minutes ?? 0,
            })}
          </li>
        </ul>
      </section>

      <section aria-labelledby="week" className="space-y-4">
        <H2 id="week">{t('report.week_title')}</H2>
        <Table
          caption={t('report.week_title')}
          head={[t('report.week_day_type'), t('report.week_bed'), t('report.week_onset'), t('report.week_wake'), t('report.week_duration'), t('report.week_mid')]}
          rows={[
            [dayType('work'), clock(report.inputs.work_bedtime), clock(c.sleep_onset_work), clock(report.inputs.work_wake_time), formatHoursMinutes(c.sleep_duration_work_hours), clock(c.mid_sleep_work)],
            [dayType('free'), clock(report.inputs.free_bedtime), clock(c.sleep_onset_free), clock(report.inputs.free_wake_time), formatHoursMinutes(c.sleep_duration_free_hours), clock(c.mid_sleep_free)],
          ]}
        />
        <p>{t('report.week_average', { value: formatHoursMinutes(c.sleep_duration_week_hours) })}</p>
      </section>

      <section aria-labelledby="plan" className="space-y-4">
        <H2 id="plan">{t('report.plan')}</H2>
        <p className="text-muted">{t('report.plan_intro')}</p>
        <Table
          caption={t('report.plan_table_caption')}
          head={[t('report.plan_day'), t('report.week_day_type'), t('report.week_bed'), t('report.week_onset'), t('report.week_wake'), t('report.plan_change')]}
          rows={f.plan_7d.map((d) => [String(d.day), dayType(d.day_type), clock(d.bedtime), clock(d.sleep_start), clock(d.wake_time), change(d.change_minutes)])}
        />
        <h3 className="text-lg font-semibold">{t('report.implementation_title')}</h3>
        <ol className="list-decimal space-y-1 pl-5">
          {f.implementation_plan.days.map((d) => (
            <li key={d.day}>
              {t('report.implementation_day', { day: d.day, type: dayType(d.day_type), bed: clock(d.bedtime), wake: clock(d.wake_time) })}
            </li>
          ))}
        </ol>
        <h4 className="font-semibold">{t('report.implementation_signals')}</h4>
        {f.implementation_plan.signals.length === 0 ? (
          <p className="text-muted">{t('report.implementation_none')}</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5">
            {f.implementation_plan.signals.map((w) => (
              <li key={w.code}>{warningText(w)}</li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="scenarios" className="space-y-4">
        <H2 id="scenarios">{t('report.scenarios')}</H2>
        <p className="text-muted">{t('report.scenarios_intro')}</p>
        <ul className="space-y-3" aria-label={t('report.scenarios_alt')}>
          {f.scenarios.map((s) => (
            <li key={s.id}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-semibold">{label(s.id, s.flexibility_min)}</span>
                <span className="font-bold tabular-nums">{formatHoursMinutes(s.sjl_hours)}</span>
              </div>
              <div className="mt-1 h-4 overflow-hidden rounded-full bg-subtle" aria-hidden="true">
                <div className={s.id === 'base' ? 'h-full bg-line-strong' : 'h-full bg-primary'} style={{ width: `${Math.max(1, (s.sjl_hours / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
        {f.scenario_more_flex.sjl_hours >= f.planned_social_jetlag_hours - 1e-9 ? <p className="text-sm text-muted">{t('report.scenario_no_improve')}</p> : null}
        {report.inputs.wake_flexibility_min + 30 > 120 ? <p className="text-sm text-muted">{t('report.scenario_cap')}</p> : null}
        <WhatIf inputs={report.inputs} params={params} />
      </section>

      <section aria-labelledby="sensitivity" className="space-y-3">
        <H2 id="sensitivity">{t('report.sensitivity')}</H2>
        <p>{t('report.sensitivity_center', { value: cur })}</p>
        <p>
          {t('report.sensitivity_range', {
            min: f.input_sensitivity.uncertainty_min,
            low: formatHoursMinutes(f.input_sensitivity.low_hours),
            high: formatHoursMinutes(f.input_sensitivity.high_hours),
          })}
        </p>
        <Callout title={t('report.sensitivity')}>{t('report.sensitivity_required')}</Callout>
        <h3 className="text-lg font-semibold">{t('report.msfsc_title')}</h3>
        <p>{f.msf_sc ? t('report.msfsc_value', { time: clock(f.msf_sc) }) : t('report.msfsc_na')}</p>
        <h3 className="text-lg font-semibold">{t('report.sjlsc_title')}</h3>
        <p>
          {formatHoursMinutes(f.social_jetlag_sleep_corrected_hours)} <span className="text-sm text-muted">— {t('report.sjlsc_note')}</span>
        </p>
      </section>

      <section aria-labelledby="assumptions" className="space-y-4">
        <H2 id="assumptions">{t('report.assumptions')}</H2>
        <Table
          caption={t('report.assumptions_table_caption')}
          head={[t('report.assumptions_table_caption'), '']}
          rows={[
            [t('report.assumptions_latency'), `${report.inputs.sleep_latency_min} min`],
            [t('report.assumptions_workdays'), String(report.inputs.workdays_per_week)],
            [t('report.assumptions_alarm'), report.inputs.free_day_alarm ? t('report.assumptions_alarm_yes') : t('report.assumptions_alarm_no')],
            [t('report.assumptions_flex'), `${report.inputs.wake_flexibility_min} min`],
            [t('report.assumptions_free_cap'), `planner_max_free_shift_min = ${f.methodology.params.planner_max_free_shift_min}`],
            [t('report.assumptions_uncertainty'), `input_time_uncertainty_min = ${f.methodology.params.input_time_uncertainty_min}`],
            [t('report.assumptions_validity'), t('report.assumptions_validity_value')],
          ]}
        />
        <h3 className="text-lg font-semibold">{t('report.assumptions_exclusions_title')}</h3>
        <ul className="list-disc space-y-1 pl-5">
          {(t.raw('report.assumptions_exclusions') as string[]).map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="method" className="space-y-4">
        <H2 id="method">{t('report.methodology')}</H2>
        {(t.raw('report.method_paragraphs') as string[]).map((p) => (
          <p key={p}>{p}</p>
        ))}
        <h3 className="text-lg font-semibold">{t('report.method_sources_title')}</h3>
        <ul className="space-y-1 text-sm">
          {Object.values(f.methodology.sources).map((u) => (
            <li key={u}>
              <a href={u} rel="noopener noreferrer" target="_blank" className="break-all">
                {u}
              </a>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">{t('report.method_mctq')}</p>
      </section>

      <section aria-labelledby="privacy" className="space-y-3">
        <H2 id="privacy">{t('report.privacy_title')}</H2>
        {(t.raw('report.privacy_paragraphs') as string[]).map((p) => (
          <p key={p}>{p}</p>
        ))}
        <p className="rounded-md bg-subtle p-4 text-sm">{t('report.health_disclaimer')}</p>
      </section>

      <footer className="space-y-1 border-t border-line pt-6 text-sm text-muted">
        <h2 className="font-semibold text-fg">{t('report.verification_title')}</h2>
        <p className="text-lg font-bold tabular-nums text-fg">{vid}</p>
        <p>{t('report.verification_generated', { date: generatedAt.toISOString() })}</p>
        <p>{t('report.verification_locale', { locale })}</p>
        <p>{t('report.verification_payload', { hash: reportHash(report) })}</p>
      </footer>
    </article>
  );
}

function ReportBand({
  report,
  pct,
  youLabel,
  labels,
}: {
  report: ReportModel;
  pct: (n: number) => string;
  youLabel: string;
  labels: Record<'menos_de_1h' | '1h_a_menos_de_2h' | '2h_o_mas', string>;
}) {
  return (
    <ReferenceBandChart
      bands={report.full.population_reference.bands}
      current={report.result.current.reference_band}
      labels={labels}
      you={youLabel}
      percent={pct}
    />
  );
}
