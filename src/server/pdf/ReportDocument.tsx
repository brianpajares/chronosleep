import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ComponentProps, ReactNode } from 'react';
import {
  directionOf,
  formatClock,
  formatHoursMinutes,
  hoursToMinutes,
  parseTime,
  type FormatLocale,
  type ReportModel,
} from '@/domain/chronosleep';

/**
 * PDF report (FR-32, ux/report_layout.md): 10 A4 pages generated from the SAME ReportModel as the
 * web report. Standard Helvetica (WinAnsi) — so text goes through `safe()` to avoid glyphs the
 * font cannot draw. Charts are drawn with Views and always carry direct labels (no colour-only).
 */

export interface T {
  (key: string, values?: Record<string, string | number>): string;
  raw(key: string): unknown;
}

const list = (t: T, key: string): string[] => (t.raw(key) as string[]) ?? [];

export interface PdfProps {
  report: ReportModel;
  locale: FormatLocale;
  t: T;
  verificationId: string;
  generatedAt: Date;
  reportHash: string;
  privacyUrl: string;
}

const C = {
  text: '#111827',
  muted: '#4b5563',
  line: '#9ca3af',
  soft: '#eef2f6',
  primary: '#155e75',
  accent: '#4338ca',
  accentSoft: '#e0e7ff',
};

const s = StyleSheet.create({
  page: { padding: 44, paddingBottom: 60, fontFamily: 'Helvetica', fontSize: 10.5, color: C.text, lineHeight: 1.45 },
  brand: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.primary },
  h1: { fontSize: 22, fontFamily: 'Helvetica-Bold', marginBottom: 8 },
  h2: { fontSize: 15, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 6 },
  p: { marginBottom: 6 },
  muted: { color: C.muted, fontSize: 9.5 },
  hero: { fontSize: 44, fontFamily: 'Helvetica-Bold', marginVertical: 6, color: C.primary },
  table: { borderWidth: 1, borderColor: C.line, marginTop: 6 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#d1d5db' },
  th: { backgroundColor: C.soft, fontFamily: 'Helvetica-Bold', padding: 5, fontSize: 9.5 },
  td: { padding: 5, fontSize: 10 },
  footer: { position: 'absolute', bottom: 24, left: 44, right: 44, fontSize: 8, color: C.muted, textAlign: 'center' },
  note: { borderWidth: 1, borderColor: C.line, padding: 8, marginTop: 8, backgroundColor: '#f9fafb' },
  bullet: { marginBottom: 3, paddingLeft: 10 },
});

const MAP: Record<string, string> = {
  '≥': '>=',
  '≤': '<=',
  '→': '->',
  '−': '-',
  '±': '+/-',
  ' ': ' ',
  ' ': ' ',
  '”': '"',
  '“': '"',
  '’': "'",
  '‘': "'",
};

/** Replaces glyphs outside WinAnsi/Latin-1 so the built-in font never renders tofu. */
export function safe(input: string): string {
  let out = '';
  for (const ch of input) {
    if (MAP[ch] !== undefined) out += MAP[ch];
    else if (ch.charCodeAt(0) <= 0xff || '–—…•€'.includes(ch)) out += ch;
    else out += '?';
  }
  return out;
}

function Txt({ children, style }: { children: ReactNode; style?: ComponentProps<typeof View>['style'] }) {
  const mapped = typeof children === 'string' ? safe(children) : children;
  return <Text style={style}>{mapped}</Text>;
}

function Row({ cells, widths, header }: { cells: string[]; widths: number[]; header?: boolean }) {
  return (
    <View style={s.tr} wrap={false}>
      {cells.map((c, i) => (
        <View key={i} style={{ width: `${widths[i]}%` }}>
          <Txt style={[header ? s.th : s.td, {}]}>{c}</Txt>
        </View>
      ))}
    </View>
  );
}

function Table({ head, rows, widths }: { head: string[]; rows: string[][]; widths: number[] }) {
  return (
    <View style={s.table}>
      <Row cells={head} widths={widths} header />
      {rows.map((r, i) => (
        <Row key={i} cells={r} widths={widths} />
      ))}
    </View>
  );
}

function Page_({ title, children, t, p }: { title?: string; children: ReactNode; t: T; p: PdfProps }) {
  return (
    <Page size="A4" style={s.page}>
      <Txt style={s.brand}>ChronoSleep</Txt>
      {title ? <Txt style={s.h1}>{title}</Txt> : null}
      {children}
      <Text
        style={s.footer}
        fixed
        render={({ pageNumber, totalPages }) =>
          safe(
            t('pdf.footer', {
              model: p.report.model_version,
              id: p.verificationId,
              page: pageNumber,
              total: totalPages,
            }),
          )
        }
      />
    </Page>
  );
}

/** 24 h timeline drawn with absolutely positioned Views (hollow/dashed = obligation days, solid = free days). */
function Timeline({ p }: { p: PdfProps }) {
  const { t, locale } = p;
  const W = 490;
  const x = (min: number) => (min / 1440) * W;
  const tracks = [
    { key: 'work', label: t('result.timeline_work'), tr: p.report.preview.weekly_timing_chart.work, solid: false },
    { key: 'free', label: t('result.timeline_free'), tr: p.report.preview.weekly_timing_chart.free, solid: true },
  ] as const;
  const segs = (a: number, b: number): [number, number][] => (b > a ? [[a, b]] : [[a, 1440], [0, b]]);
  const wMid = parseTime(p.report.result.current.mid_sleep_work);
  const fMid = parseTime(p.report.result.current.mid_sleep_free);
  const lo = Math.min(wMid, fMid);
  const hi = Math.max(wMid, fMid);
  const wraps = hi - lo > 720;

  return (
    <View style={{ marginTop: 10 }}>
      {tracks.map(({ key, label, tr, solid }) => {
        const start = parseTime(tr.sleep_start);
        const end = parseTime(tr.wake_time);
        const mid = parseTime(tr.mid_sleep);
        return (
          <View key={key} style={{ marginBottom: 20 }}>
            <Txt style={{ fontFamily: 'Helvetica-Bold', marginBottom: 3 }}>{label}</Txt>
            <View style={{ width: W, height: 18, backgroundColor: C.soft, position: 'relative' }}>
              {segs(start, end).map(([a, b], i) => (
                <View
                  key={i}
                  style={{
                    position: 'absolute',
                    left: x(a),
                    width: Math.max(2, x(b) - x(a)),
                    top: 0,
                    height: 18,
                    backgroundColor: solid ? C.primary : C.accentSoft,
                    borderWidth: 1.5,
                    borderColor: solid ? C.primary : C.accent,
                    borderStyle: solid ? 'solid' : 'dashed',
                  }}
                />
              ))}
              <View style={{ position: 'absolute', left: x(mid) - 1, top: -3, width: 2, height: 24, backgroundColor: C.text }} />
            </View>
            <Txt style={{ fontSize: 9, marginTop: 2 }}>
              {`${t('result.timeline_mid')} ${formatClock(tr.mid_sleep, locale)} | ${formatClock(tr.sleep_start, locale)} - ${formatClock(tr.wake_time, locale)}`}
            </Txt>
          </View>
        );
      })}
      <View style={{ width: W, height: 10, position: 'relative' }}>
        {wraps ? (
          <>
            <View style={{ position: 'absolute', left: x(hi), width: W - x(hi), top: 4, height: 2, backgroundColor: C.text }} />
            <View style={{ position: 'absolute', left: 0, width: x(lo), top: 4, height: 2, backgroundColor: C.text }} />
          </>
        ) : (
          <View style={{ position: 'absolute', left: x(lo), width: Math.max(2, x(hi) - x(lo)), top: 4, height: 2, backgroundColor: C.text }} />
        )}
      </View>
      <View style={{ width: W, flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        {[0, 6, 12, 18, 24].map((h) => (
          <Txt key={h} style={{ fontSize: 8, color: C.muted }}>
            {locale === 'en' ? `${h % 12 === 0 ? 12 : h % 12}${h % 24 >= 12 && h !== 24 ? 'PM' : 'AM'}` : String(h).padStart(2, '0')}
          </Txt>
        ))}
      </View>
      <Txt style={[s.muted, { marginTop: 4 }]}>{`${t('pdf.chart_caption_timeline')} ${t('result.pattern_note')}`}</Txt>
    </View>
  );
}

function ScenarioBars({ p }: { p: PdfProps }) {
  const { t } = p;
  const scenarios = p.report.full.scenarios;
  const max = Math.max(0.25, ...scenarios.map((x) => x.sjl_hours));
  const W = 330;
  const label = (id: string, flex: number | null) =>
    id === 'base'
      ? t('report.scenario_base')
      : id === 'no_flex'
        ? t('report.scenario_no_flex')
        : id === 'current_flex'
          ? t('report.scenario_current_flex', { min: flex ?? 0 })
          : t('report.scenario_more_flex', { min: flex ?? 0 });
  return (
    <View style={{ marginTop: 8 }}>
      {scenarios.map((sc) => (
        <View key={sc.id} style={{ marginBottom: 10 }}>
          <Txt style={{ fontSize: 9.5, marginBottom: 2 }}>{label(sc.id, sc.flexibility_min)}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: W, height: 16, backgroundColor: C.soft }}>
              <View style={{ width: Math.max(2, (sc.sjl_hours / max) * W), height: 16, backgroundColor: sc.id === 'base' ? C.line : C.primary }} />
            </View>
            <Txt style={{ marginLeft: 8, fontFamily: 'Helvetica-Bold' }}>{formatHoursMinutes(sc.sjl_hours)}</Txt>
          </View>
        </View>
      ))}
      <Txt style={s.muted}>{`0 - ${formatHoursMinutes(max)} | ${t('pdf.chart_caption_scenarios')}`}</Txt>
    </View>
  );
}

export function ReportDocument(p: PdfProps) {
  const { report, locale, t } = p;
  const c = report.result.current;
  const plan = report.result.plan;
  const dir = directionOf(c.social_jetlag_relative_hours);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(p.generatedAt);
  const dayType = (d: 'work' | 'free') => t(d === 'work' ? 'report.day_work' : 'report.day_free');
  const cur = formatHoursMinutes(c.social_jetlag_hours);
  const planned = formatHoursMinutes(report.full.planned_social_jetlag_hours);
  const changeLabel = (m: number) =>
    m === 0 ? t('report.plan_change_none') : m > 0 ? t('report.plan_change_later', { min: m }) : t('report.plan_change_earlier', { min: Math.abs(m) });
  const bandLabel = {
    menos_de_1h: t('result.reference_lt1'),
    '1h_a_menos_de_2h': t('result.reference_1_2'),
    '2h_o_mas': t('result.reference_ge2'),
  }[c.reference_band];
  const warningText = (w: ReportModel['warnings'][number]) =>
    t(`result.warnings.${w.code}`, { hours: formatHoursMinutes(w.value_hours ?? 0) });
  const bandLabels = {
    menos_de_1h: t('result.reference_lt1'),
    '1h_a_menos_de_2h': t('result.reference_1_2'),
    '2h_o_mas': t('result.reference_ge2'),
  } as const;
  const shares = report.full.population_reference.bands;
  const lat = report.inputs.sleep_latency_min;
  const driverComp = report.full.drivers[1]!;
  const driverFlex = report.full.drivers[2]!;
  const compH = hoursToMinutes(Math.abs(driverComp.minutes) / 60);
  const flexDetail = driverFlex.detail as Record<string, number>;

  return (
    <Document
      title={safe(`${t('pdf.tagline_cover')} - ChronoSleep`)}
      author="ChronoSleep"
      subject={safe(t('pdf.disclaimer_short'))}
      creator="ChronoSleep"
      producer="ChronoSleep"
      language={locale}
    >
      {/* 1 — cover */}
      <Page_ t={t} p={p}>
        <Txt style={[s.muted, { marginTop: 4 }]}>{t('brand_tagline')}</Txt>
        <Txt style={{ fontSize: 13, marginTop: 28 }}>{t('pdf.tagline_cover')}</Txt>
        <Txt style={[s.h2, { marginTop: 24 }]}>{t('pdf.cover_label')}</Txt>
        <Txt style={s.hero}>{cur}</Txt>
        <Txt style={s.p}>
          {t(dir === 'later' ? 'pdf.cover_direction_later' : dir === 'earlier' ? 'pdf.cover_direction_earlier' : 'pdf.cover_direction_aligned')}
        </Txt>
        <Timeline p={p} />
        <View style={{ marginTop: 20 }}>
          <Txt style={s.muted}>{t('pdf.generated', { date })}</Txt>
          <Txt style={s.muted}>{t('pdf.version_line', { model: report.model_version, id: p.verificationId })}</Txt>
        </View>
        <View style={s.note}>
          <Txt>{t('pdf.disclaimer_short')}</Txt>
        </View>
      </Page_>

      {/* 2 — meaning + drivers + population */}
      <Page_ title={t('pdf.meaning_page')} t={t} p={p}>
        <Txt style={s.h2}>{t('report.meaning_midpoints')}</Txt>
        <Txt>{t('report.meaning_work', { time: formatClock(c.mid_sleep_work, locale) })}</Txt>
        <Txt>{t('report.meaning_free', { time: formatClock(c.mid_sleep_free, locale) })}</Txt>
        {list(t, 'report.meaning_paragraphs').map((para, i) => (
          <Txt key={i} style={[s.p, i === 0 ? { marginTop: 8 } : {}]}>{para}</Txt>
        ))}

        <Txt style={s.h2}>{t('report.drivers_title')}</Txt>
        <Txt style={s.bullet}>
          {dir === 'aligned'
            ? t('report.driver_midpoint_gap_aligned')
            : t(dir === 'later' ? 'report.driver_midpoint_gap_later' : 'report.driver_midpoint_gap_earlier', { value: cur })}
        </Txt>
        <Txt style={s.bullet}>
          {compH === 0
            ? t('report.driver_compensation_same')
            : t(driverComp.minutes > 0 ? 'report.driver_compensation_more' : 'report.driver_compensation_less', {
                value: formatHoursMinutes(compH / 60),
                free: String(c.sleep_duration_free_hours),
                work: String(c.sleep_duration_work_hours),
              })}
        </Txt>
        <Txt style={s.bullet}>
          {t('report.driver_flexibility', {
            flex: driverFlex.minutes,
            need: formatHoursMinutes((flexDetail.needed_minutes ?? 0) / 60),
            work: formatHoursMinutes((flexDetail.work_shift_minutes ?? 0) / 60),
            free: formatHoursMinutes((flexDetail.free_shift_minutes ?? 0) / 60),
            cap: flexDetail.free_cap_minutes ?? 0,
          })}
        </Txt>

        <Txt style={s.h2}>{t('result.reference_title')}</Txt>
        <Txt style={s.p}>{t('result.reference_band', { band: bandLabel })}</Txt>
        {shares.map((b) => (
          <View key={b.band} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
            <Txt style={{ width: 150, fontFamily: b.band === c.reference_band ? 'Helvetica-Bold' : 'Helvetica' }}>
              {`${b.band === c.reference_band ? '> ' : ''}${bandLabels[b.band]}`}
            </Txt>
            <View style={{ width: 220, height: 12, backgroundColor: C.soft }}>
              <View style={{ width: Math.max(2, b.share * 220), height: 12, backgroundColor: b.band === c.reference_band ? C.primary : C.line }} />
            </View>
            <Txt style={{ marginLeft: 8 }}>{`${(b.share * 100).toFixed(1)}%`}</Txt>
          </View>
        ))}
        <Txt style={s.muted}>{`${t('report.population_caption')} ${t('pdf.population_source')}`}</Txt>
      </Page_>

      {/* 3 — current week */}
      <Page_ title={t('pdf.week_page')} t={t} p={p}>
        <Table
          head={[t('report.week_day_type'), t('report.week_bed'), t('report.week_onset'), t('report.week_wake'), t('report.week_duration'), t('report.week_mid')]}
          widths={[22, 14, 18, 14, 15, 17]}
          rows={[
            [dayType('work'), formatClock(report.inputs.work_bedtime, locale), formatClock(c.sleep_onset_work, locale), formatClock(report.inputs.work_wake_time, locale), formatHoursMinutes(c.sleep_duration_work_hours), formatClock(c.mid_sleep_work, locale)],
            [dayType('free'), formatClock(report.inputs.free_bedtime, locale), formatClock(c.sleep_onset_free, locale), formatClock(report.inputs.free_wake_time, locale), formatHoursMinutes(c.sleep_duration_free_hours), formatClock(c.mid_sleep_free, locale)],
          ]}
        />
        <Txt style={[s.p, { marginTop: 10 }]}>{t('report.week_average', { value: formatHoursMinutes(c.sleep_duration_week_hours) })}</Txt>
        {report.warnings.map((w) => (
          <View key={w.code} style={s.note}>
            <Txt>{warningText(w)}</Txt>
          </View>
        ))}
      </Page_>

      {/* 4 — plan + implementation */}
      <Page_ title={t('pdf.plan_page')} t={t} p={p}>
        <Txt style={s.p}>{t('report.plan_intro')}</Txt>
        <Table
          head={[t('report.plan_day'), t('report.week_day_type'), t('report.week_bed'), t('report.week_onset'), t('report.week_wake'), t('report.plan_change')]}
          widths={[9, 21, 15, 17, 15, 23]}
          rows={report.full.plan_7d.map((d) => [
            String(d.day),
            dayType(d.day_type),
            formatClock(d.bedtime, locale),
            formatClock(d.sleep_start, locale),
            formatClock(d.wake_time, locale),
            changeLabel(d.change_minutes),
          ])}
        />
        <Txt style={s.h2}>{t('report.implementation_title')}</Txt>
        {report.full.implementation_plan.days.map((d) => (
          <Txt key={d.day} style={s.bullet}>
            {t('report.implementation_day', {
              day: d.day,
              type: dayType(d.day_type),
              bed: formatClock(d.bedtime, locale),
              wake: formatClock(d.wake_time, locale),
            })}
          </Txt>
        ))}
        <Txt style={[s.p, { marginTop: 6, fontFamily: 'Helvetica-Bold' }]}>{t('report.implementation_signals')}</Txt>
        {report.full.implementation_plan.signals.length === 0 ? (
          <Txt style={s.muted}>{t('report.implementation_none')}</Txt>
        ) : (
          report.full.implementation_plan.signals.map((w) => (
            <Txt key={w.code} style={s.bullet}>{`- ${warningText(w)}`}</Txt>
          ))
        )}
        <Txt style={[s.muted, { marginTop: 6 }]}>{t('report.plan_table_caption')}</Txt>
      </Page_>

      {/* 5 — scenarios */}
      <Page_ title={t('pdf.scenarios_page')} t={t} p={p}>
        <Txt style={s.p}>{t('report.scenarios_intro')}</Txt>
        <ScenarioBars p={p} />
        {report.full.scenario_more_flex.sjl_hours >= report.full.planned_social_jetlag_hours - 1e-9 ? (
          <View style={s.note}>
            <Txt>{t('report.scenario_no_improve')}</Txt>
          </View>
        ) : null}
        {report.inputs.wake_flexibility_min + 30 > 120 ? <Txt style={[s.muted, { marginTop: 6 }]}>{t('report.scenario_cap')}</Txt> : null}
        <Txt style={[s.p, { marginTop: 10 }]}>{t('report.summary_current')}: {cur}</Txt>
        <Txt style={s.p}>{t('report.summary_planned')}: {planned}</Txt>
      </Page_>

      {/* 6 — sensitivity */}
      <Page_ title={t('pdf.sensitivity_page')} t={t} p={p}>
        <Txt style={s.p}>{t('report.sensitivity_center', { value: cur })}</Txt>
        <Txt style={s.p}>
          {t('report.sensitivity_range', {
            min: report.full.input_sensitivity.uncertainty_min,
            low: formatHoursMinutes(report.full.input_sensitivity.low_hours),
            high: formatHoursMinutes(report.full.input_sensitivity.high_hours),
          })}
        </Txt>
        <View style={s.note}>
          <Txt>{t('report.sensitivity_required')}</Txt>
        </View>
        <Txt style={s.h2}>{t('report.msfsc_title')}</Txt>
        <Txt>{report.full.msf_sc ? t('report.msfsc_value', { time: formatClock(report.full.msf_sc, locale) }) : t('report.msfsc_na')}</Txt>
        <Txt style={s.h2}>{t('report.sjlsc_title')}</Txt>
        <Txt>{formatHoursMinutes(report.full.social_jetlag_sleep_corrected_hours)}</Txt>
        <Txt style={s.muted}>{t('report.sjlsc_note')}</Txt>
      </Page_>

      {/* 7 — assumptions */}
      <Page_ title={t('pdf.assumptions_page')} t={t} p={p}>
        <Table
          head={[t('report.assumptions_table_caption'), '']}
          widths={[62, 38]}
          rows={[
            [t('report.assumptions_latency'), `${lat} min`],
            [t('report.assumptions_workdays'), String(report.inputs.workdays_per_week)],
            [t('report.assumptions_alarm'), report.inputs.free_day_alarm ? t('report.assumptions_alarm_yes') : t('report.assumptions_alarm_no')],
            [t('report.assumptions_flex'), `${report.inputs.wake_flexibility_min} min`],
            [t('report.assumptions_free_cap'), `planner_max_free_shift_min = ${report.full.methodology.params.planner_max_free_shift_min}`],
            [t('report.assumptions_uncertainty'), `input_time_uncertainty_min = ${report.full.methodology.params.input_time_uncertainty_min}`],
            [t('report.assumptions_validity'), t('report.assumptions_validity_value')],
          ]}
        />
        <Txt style={s.h2}>{t('report.assumptions_exclusions_title')}</Txt>
        {list(t, 'report.assumptions_exclusions').map((x, i) => (
          <Txt key={i} style={s.bullet}>{`- ${x}`}</Txt>
        ))}
      </Page_>

      {/* 8 — methodology */}
      <Page_ title={t('pdf.method_page')} t={t} p={p}>
        {list(t, 'report.method_paragraphs').map((x, i) => (
          <Txt key={i} style={s.p}>{x}</Txt>
        ))}
        <Txt style={s.h2}>{t('report.method_sources_title')}</Txt>
        {Object.values(report.full.methodology.sources).map((u) => (
          <Txt key={u} style={[s.bullet, { fontSize: 9 }]}>{u}</Txt>
        ))}
        <View style={s.note}>
          <Txt>{t('report.method_mctq')}</Txt>
        </View>
      </Page_>

      {/* 9 — privacy & health */}
      <Page_ title={t('pdf.privacy_page')} t={t} p={p}>
        {list(t, 'report.privacy_paragraphs').map((x, i) => (
          <Txt key={i} style={s.p}>{x}</Txt>
        ))}
        <Txt style={[s.muted, { marginTop: 8 }]}>{t('pdf.privacy_url', { url: p.privacyUrl })}</Txt>
      </Page_>

      {/* 10 — verification */}
      <Page_ title={t('pdf.verification_page')} t={t} p={p}>
        <Txt style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', marginVertical: 8 }}>{p.verificationId}</Txt>
        <Txt style={s.p}>{`${t('report.model_label')}: ${report.model_version}`}</Txt>
        <Txt style={s.p}>{`${t('report.report_version_label')}: ${report.report_version}`}</Txt>
        <Txt style={s.p}>{t('report.verification_generated', { date: p.generatedAt.toISOString() })}</Txt>
        <Txt style={s.p}>{t('report.verification_locale', { locale })}</Txt>
        <Txt style={s.p}>{`${t('pdf.report_hash')}: ${p.reportHash}`}</Txt>
        <Txt style={[s.muted, { marginTop: 8 }]}>{t('pdf.qr_note')}</Txt>
      </Page_>
    </Document>
  );
}
