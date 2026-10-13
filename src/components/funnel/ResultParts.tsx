import { Check, Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import type { BandShare, ReferenceBand as Band } from '@/domain/chronosleep';
import { formatHoursMinutes } from '@/domain/chronosleep';
import { cn } from '@/lib/utils';

/* ---------------------------------------------------------------- SensitivityRange */

export function SensitivityRange({
  low,
  center,
  high,
  labels,
}: {
  low: number;
  center: number;
  high: number;
  labels: { title: string; tooltip: string; low: string; center: string; high: string; scale: string; note: string };
}) {
  const max = Math.max(4, Math.ceil(high) + 1);
  const pct = (h: number) => `${(h / max) * 100}%`;
  return (
    <div>
      <p className="text-sm font-semibold text-fg">
        {labels.title}{' '}
        <abbr title={labels.tooltip} className="cursor-help text-muted no-underline" aria-label={labels.tooltip}>
          (?)
        </abbr>
      </p>
      <div
        role="img"
        aria-label={`${labels.low} ${formatHoursMinutes(low)}, ${labels.center} ${formatHoursMinutes(center)}, ${labels.high} ${formatHoursMinutes(high)}. ${labels.scale}`}
        className="relative mt-4 h-10"
      >
        <div className="absolute inset-x-0 top-4 h-2 rounded-full bg-subtle" />
        <div
          className="absolute top-3 h-4 rounded-full border-2 border-primary bg-primary-soft"
          style={{ left: pct(low), width: `calc(${pct(high)} - ${pct(low)})` }}
        />
        <div
          className="absolute top-1 size-8 -translate-x-1/2 rounded-full border-4 border-primary bg-surface shadow-sm"
          style={{ left: pct(center) }}
        />
      </div>
      <div className="relative mt-1 flex justify-between text-xs text-muted tabular-nums" aria-hidden="true">
        <span>0 h</span>
        <span>{max} h</span>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
        {(
          [
            [labels.low, low],
            [labels.center, center],
            [labels.high, high],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="rounded-md bg-subtle px-2 py-2">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="font-bold tabular-nums">{formatHoursMinutes(v)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm text-muted">{labels.note}</p>
    </div>
  );
}

/* ---------------------------------------------------------------- ReferenceBand */

export function ReferenceBandChart({
  bands,
  current,
  labels,
  you,
  percent,
}: {
  bands: BandShare[];
  current: Band;
  labels: Record<Band, string>;
  you: string;
  percent: (share: number) => string;
}) {
  return (
    <ul className="space-y-2">
      {bands.map((b) => {
        const active = b.band === current;
        return (
          <li key={b.band}>
            <div
              className={cn(
                'flex items-center gap-3 rounded-md border px-3 py-2',
                active ? 'border-primary bg-primary-soft' : 'border-line bg-surface',
              )}
            >
              {active ? <Check aria-hidden="true" className="size-5 shrink-0" /> : <span className="size-5 shrink-0" />}
              <span className="flex-1 text-sm font-semibold">
                {labels[b.band]}
                {active ? <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-on-primary">{you}</span> : null}
              </span>
              <span className="text-sm font-bold tabular-nums">{percent(b.share)}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-subtle" aria-hidden="true">
              <div className={cn('h-full rounded-full', active ? 'bg-primary' : 'bg-line-strong')} style={{ width: `${b.share * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------------------------------------------------------- LockedReportCard */

/** Title + a real fragment, the rest hidden behind a legible label — no blur, no scroll-trap. */
export function LockedReportCard({
  title,
  lockedLabel,
  visibleLabel,
  children,
  rest,
}: {
  title: string;
  lockedLabel: string;
  visibleLabel: string;
  children: ReactNode;
  rest?: ReactNode;
}) {
  return (
    <article className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold">{title}</h3>
          <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-fg">{visibleLabel}</span>
        </div>
        <div className="mt-3 text-sm text-fg">{children}</div>
      </div>
      <div className="flex items-center gap-2 border-t border-dashed border-line-strong bg-subtle px-5 py-3 text-sm font-semibold text-muted">
        <Lock aria-hidden="true" className="size-4 shrink-0" />
        <span>
          {lockedLabel}
          {rest ? <span className="block font-normal">{rest}</span> : null}
        </span>
      </div>
    </article>
  );
}
