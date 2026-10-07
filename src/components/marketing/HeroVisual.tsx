import { getTranslations } from 'next-intl/server';
import { ScheduleTimeline24h } from '@/components/funnel/ScheduleTimeline24h';
import { Badge, Card } from '@/components/ui/primitives';
import type { FormatLocale } from '@/domain/chronosleep';

/** Illustrative example (TV01-style numbers) — clearly labelled, never presented as user data. */
export async function HeroVisual({ locale }: { locale: FormatLocale }) {
  const t = await getTranslations('landing');
  const r = await getTranslations('result');

  return (
    <Card className="relative overflow-hidden p-5 shadow-lg sm:p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-accent-soft opacity-70 blur-3xl"
      />
      <div className="relative">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t('visual_title')}</h2>
          <Badge tone="accent">{t('example_badge')}</Badge>
        </div>
        <ScheduleTimeline24h
          work={{ sleepStart: '23:45', wake: '06:45', mid: '03:15' }}
          free={{ sleepStart: '01:15', wake: '09:00', mid: '05:08' }}
          gapText="1 h 53 min"
          locale={locale}
          idPrefix="landing"
          animate
          labels={{
            work: t('visual_work'),
            free: t('visual_free'),
            mid: r('timeline_mid'),
            gap: t('visual_gap'),
            scale: r('timeline_scale'),
            title: t('visual_title'),
            alt: t('visual_alt'),
            patternNote: r('pattern_note'),
          }}
        />
      </div>
    </Card>
  );
}
