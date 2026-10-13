'use client';

import { CalendarPlus, Download } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, Label } from '@/components/ui/primitives';
import { calculate, formatHoursMinutes, type EngineParams, type Inputs } from '@/domain/chronosleep';
import { track } from '@/lib/analytics';

/** Download actions: PDF is the primary action, ICS secondary (ux_spec 4.8). */
export function ReportActions({ pdfHref, icsHref, modelVersion, reportVersion }: { pdfHref: string; icsHref: string; modelVersion: string; reportVersion: string }) {
  const t = useTranslations('report');
  const locale = useLocale();
  return (
    <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center">
      <Button asChild size="lg">
        <a href={pdfHref} download onClick={() => track('report_pdf_download', { model_version: modelVersion, report_version: reportVersion, locale })}>
          <Download aria-hidden="true" className="size-5" />
          {t('download')}
        </a>
      </Button>
      <Button asChild size="lg" variant="secondary">
        <a href={icsHref} download onClick={() => track('calendar_export', { locale })}>
          <CalendarPlus aria-hidden="true" className="size-5" />
          {t('download_ics')}
        </a>
      </Button>
    </div>
  );
}

/**
 * "Try another flexibility": the engine is pure TypeScript, so this runs in the browser —
 * no request, no data leaves the page.
 */
export function WhatIf({ inputs, params }: { inputs: Inputs; params: EngineParams }) {
  const t = useTranslations('report');
  const [flex, setFlex] = useState(inputs.wake_flexibility_min);
  const result = useMemo(() => calculate({ ...inputs, wake_flexibility_min: flex }, params), [inputs, flex, params]);
  const w = result.plan.work_shift_minutes;
  const f = result.plan.free_shift_minutes;
  const shift = (m: number) => (m === 0 ? t('whatif_shift_none') : m > 0 ? t('plan_change_later', { min: m }) : t('plan_change_earlier', { min: Math.abs(m) }));
  const planned = result.plan.planned_social_jetlag_hours;

  return (
    <Card className="no-print p-5 sm:p-6">
      <h3 className="text-lg font-semibold">{t('whatif_title')}</h3>
      <p className="mt-1 text-sm text-muted">{t('whatif_body')}</p>
      <div className="mt-5 flex items-baseline justify-between gap-3">
        <Label htmlFor="whatif-range">{t('whatif_label', { min: flex })}</Label>
      </div>
      <input
        id="whatif-range"
        type="range"
        min={0}
        max={120}
        step={5}
        value={flex}
        onChange={(e) => setFlex(Number(e.target.value))}
        aria-valuetext={t('whatif_label', { min: flex })}
        className="mt-1 h-11 w-full"
      />
      <div role="status" aria-live="polite" className="mt-3 rounded-md bg-subtle p-4">
        <p className="text-2xl font-extrabold tabular-nums text-primary">{t('whatif_result', { value: formatHoursMinutes(planned) })}</p>
        <p className="mt-1 text-sm text-muted">{t('whatif_shifts', { work: shift(w), free: shift(f) })}</p>
      </div>
    </Card>
  );
}
