import { formatClock, parseTime, type FormatLocale } from '@/domain/chronosleep';
import { cn } from '@/lib/utils';

export interface TimelineTrack {
  /** Sleep onset (HH:MM). */
  sleepStart: string;
  /** Wake time (HH:MM). */
  wake: string;
  /** Midpoint of sleep (HH:MM). */
  mid: string;
}

export interface TimelineLabels {
  work: string;
  free: string;
  mid: string;
  gap: string;
  scale: string;
  title: string;
  alt: string;
  patternNote: string;
}

interface Props {
  work: TimelineTrack;
  free: TimelineTrack;
  /** Pre-formatted distance, e.g. "1 h 53 min". */
  gapText: string;
  locale: FormatLocale;
  labels: TimelineLabels;
  idPrefix: string;
  animate?: boolean;
  className?: string;
}

type Layout = 'wide' | 'narrow';

const GEOMETRY = {
  wide: { w: 720, x0: 28, x1: 692, rowH: 38, top: 22, font: 13, label: 14 },
  narrow: { w: 360, x0: 14, x1: 346, rowH: 34, top: 20, font: 11.5, label: 12.5 },
} as const;

/** Vertical rhythm derived from the layout so labels never collide. */
function vertical(g: (typeof GEOMETRY)[Layout]) {
  const workY = g.top + 24;
  const workMidY = workY + g.rowH + 22;
  const freeLabelY = workMidY + 36;
  const freeY = freeLabelY + 24;
  const freeMidY = freeY + g.rowH + 22;
  const bracketY = freeMidY + 34;
  const bracketTextY = bracketY + 26;
  const axisLineY = bracketTextY + 20;
  const axisLabelY = axisLineY + 22;
  return {
    workLabelY: g.top,
    workY,
    workMidY,
    freeLabelY,
    freeY,
    freeMidY,
    bracketY,
    bracketTextY,
    axisLineY,
    axisLabelY,
    h: axisLabelY + 12,
  };
}

const HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

function segments(startMin: number, endMin: number): Array<[number, number]> {
  if (endMin > startMin) return [[startMin, endMin]];
  // Crosses midnight: wrap around instead of drawing a negative duration.
  return [
    [startMin, 1440],
    [0, endMin],
  ];
}

function axisLabel(h: number, locale: FormatLocale): string {
  if (locale === 'en') {
    const hh = h % 24;
    const suffix = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return `${h12}${suffix}`;
  }
  return String(h).padStart(2, '0');
}

function TimelineSvg({
  layout,
  work,
  free,
  gapText,
  locale,
  labels,
  idPrefix,
  animate,
  className,
}: Props & { layout: Layout }) {
  const g = GEOMETRY[layout];
  const v = vertical(g);
  const span = g.x1 - g.x0;
  const px = (min: number) => g.x0 + (min / 1440) * span;
  const id = `${idPrefix}-${layout}`;

  const tracks = [
    { key: 'work', t: work, y: v.workY, labelY: v.workLabelY, midY: v.workMidY, label: labels.work, hatch: true },
    { key: 'free', t: free, y: v.freeY, labelY: v.freeLabelY, midY: v.freeMidY, label: labels.free, hatch: false },
  ] as const;

  const wMid = parseTime(work.mid);
  const fMid = parseTime(free.mid);
  const direct = Math.abs(fMid - wMid);
  const wraps = direct > 720;
  const lo = Math.min(wMid, fMid);
  const hi = Math.max(wMid, fMid);

  return (
    <svg
      viewBox={`0 0 ${g.w} ${v.h}`}
      role="img"
      aria-labelledby={`${id}-title ${id}-desc`}
      className={cn('block h-auto w-full', className)}
      fontFamily="inherit"
    >
      <title id={`${id}-title`}>{labels.title}</title>
      <desc id={`${id}-desc`}>{labels.alt}</desc>
      <defs>
        <pattern id={`${id}-hatch`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="8" height="8" fill="var(--accent-soft)" />
          <line x1="0" y1="0" x2="0" y2="8" stroke="var(--accent)" strokeWidth="4" />
        </pattern>
      </defs>

      {/* 24 h axis + guides */}
      <g aria-hidden="true">
        {HOURS.map((h) => (
          <line
            key={`g${h}`}
            x1={px(h * 60)}
            x2={px(h * 60)}
            y1={v.workY - 10}
            y2={v.axisLineY}
            stroke="var(--border)"
            strokeDasharray="2 5"
            opacity="0.7"
          />
        ))}
        <line x1={g.x0} x2={g.x1} y1={v.axisLineY} y2={v.axisLineY} stroke="var(--border-strong)" strokeWidth="1" />
        {HOURS.map((h) => {
          const x = px(h * 60);
          const major = h % 6 === 0;
          return (
            <g key={h}>
              <line x1={x} x2={x} y1={v.axisLineY} y2={v.axisLineY + (major ? 7 : 4)} stroke="var(--border-strong)" />
              {layout === 'wide' || major ? (
                <text
                  x={x}
                  y={v.axisLabelY}
                  textAnchor={h === 0 ? 'start' : h === 24 ? 'end' : 'middle'}
                  fontSize={g.font - 1}
                  fill="var(--text-muted)"
                >
                  {axisLabel(h, locale)}
                </text>
              ) : null}
            </g>
          );
        })}
      </g>

      {tracks.map(({ key, t, y, labelY, midY, label, hatch }, idx) => {
        const start = parseTime(t.sleepStart);
        const end = parseTime(t.wake);
        const mid = parseTime(t.mid);
        const x = px(mid);
        const cy = y + g.rowH / 2;
        return (
          <g key={key}>
            <text x={g.x0} y={labelY + g.label} fontSize={g.label} fontWeight="700" fill="var(--text)">
              {label}
            </text>
            <rect x={g.x0} y={y} width={span} height={g.rowH} rx="10" fill="var(--surface-subtle)" />
            {segments(start, end).map(([a, b], i) => (
              <rect
                key={i}
                x={px(a)}
                y={y}
                width={Math.max(3, px(b) - px(a))}
                height={g.rowH}
                rx={6}
                fill={hatch ? `url(#${id}-hatch)` : 'var(--primary)'}
                stroke={hatch ? 'var(--accent)' : 'var(--primary)'}
                strokeWidth="1.5"
                className={animate ? 'animate-grow' : undefined}
                style={
                  animate
                    ? { transformBox: 'fill-box', transformOrigin: 'left center', animationDelay: `${idx * 160}ms` }
                    : undefined
                }
              />
            ))}
            {/* midpoint marker: diamond (work) / circle (free) so shape, not colour alone, tells them apart */}
            <line x1={x} x2={x} y1={y - 6} y2={y + g.rowH + 8} stroke="var(--text)" strokeWidth="1.5" strokeDasharray="3 3" />
            {hatch ? (
              <rect
                x={x - 7}
                y={cy - 7}
                width="14"
                height="14"
                transform={`rotate(45 ${x} ${cy})`}
                fill="var(--surface)"
                stroke="var(--text)"
                strokeWidth="2"
              />
            ) : (
              <circle cx={x} cy={cy} r="8" fill="var(--surface)" stroke="var(--text)" strokeWidth="2" />
            )}
            <text
              x={Math.min(Math.max(x, g.x0 + 56), g.x1 - 56)}
              y={midY}
              textAnchor="middle"
              fontSize={g.font}
              fontWeight="600"
              fill="var(--text)"
            >
              {labels.mid} {formatClock(t.mid, locale)}
            </text>
          </g>
        );
      })}

      {/* distance between midpoints (shortest way around the clock) */}
      <g aria-hidden="true">
        {wraps ? (
          <>
            <line x1={px(hi)} x2={g.x1} y1={v.bracketY} y2={v.bracketY} stroke="var(--text)" strokeWidth="2" />
            <line x1={g.x0} x2={px(lo)} y1={v.bracketY} y2={v.bracketY} stroke="var(--text)" strokeWidth="2" />
          </>
        ) : (
          <line x1={px(lo)} x2={px(hi)} y1={v.bracketY} y2={v.bracketY} stroke="var(--text)" strokeWidth="2" />
        )}
        <line x1={px(wMid)} x2={px(wMid)} y1={v.bracketY - 7} y2={v.bracketY + 7} stroke="var(--text)" strokeWidth="2" />
        <line x1={px(fMid)} x2={px(fMid)} y1={v.bracketY - 7} y2={v.bracketY + 7} stroke="var(--text)" strokeWidth="2" />
        <text
          x={(g.x0 + g.x1) / 2}
          y={v.bracketTextY}
          textAnchor="middle"
          fontSize={g.label + 1}
          fontWeight="800"
          fill="var(--text)"
        >
          {labels.gap}: {gapText}
        </text>
      </g>
    </svg>
  );
}

/**
 * ScheduleTimeline24h — two sleep tracks on a 24 h axis with midpoints and the distance between them.
 * Server-renderable (no hooks). Intervals that cross midnight are split, never negative.
 * Two geometries chosen by container width: a wide one and a larger-type one for narrow cards/360 px.
 */
export function ScheduleTimeline24h(props: Props) {
  return (
    <figure className={cn('@container w-full', props.className)}>
      <TimelineSvg {...props} layout="wide" className="hidden @xl:block" />
      <TimelineSvg {...props} layout="narrow" className="@xl:hidden" />
      <figcaption className="mt-2 text-xs text-muted">
        <span className="sr-only">{props.labels.scale}. </span>
        {props.labels.patternNote}
      </figcaption>
    </figure>
  );
}
