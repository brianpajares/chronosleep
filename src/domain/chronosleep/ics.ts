import { parseTime } from './time';
import type { PlanRow } from './report';

export interface IcsLabels {
  workSummary: string;
  freeSummary: string;
  description: string;
}

export interface IcsOptions {
  /** Date of "day 1" (UTC date components are used as a floating local date). */
  startDate: Date;
  /** Opaque report/verification id used to build stable UIDs. */
  id: string;
  labels: IcsLabels;
  /** DTSTAMP; injectable for deterministic tests. */
  now?: Date;
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

function hms(totalMinutes: number): string {
  return `${pad(Math.floor(totalMinutes / 60))}${pad(totalMinutes % 60)}00`;
}

function utcStamp(d: Date): string {
  return `${ymd(d)}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** RFC 5545 line folding at 75 octets (counted on UTF-8 bytes). */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > limit) {
      parts.push(current);
      current = ' ';
      bytes = 1;
      limit = 75;
    }
    current += ch;
    bytes += b;
  }
  parts.push(current);
  return parts.join('\r\n');
}

/**
 * ICS export of the simulated 7-day plan. Events use floating local times (no TZID) so
 * they land on the viewer's own clock; a sleep episode that crosses midnight ends next day.
 */
export function buildIcs(plan: PlanRow[], opts: IcsOptions): string {
  const now = opts.now ?? new Date();
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ChronoSleep//Plan 7d//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  for (const row of plan) {
    const day = new Date(
      Date.UTC(
        opts.startDate.getUTCFullYear(),
        opts.startDate.getUTCMonth(),
        opts.startDate.getUTCDate() + row.day - 1,
      ),
    );
    const bed = parseTime(row.bedtime);
    const wake = parseTime(row.wake_time);
    const endDay = wake <= bed ? new Date(day.getTime() + 86_400_000) : day;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${opts.id}-d${row.day}@chronosleep`,
      `DTSTAMP:${utcStamp(now)}`,
      `DTSTART:${ymd(day)}T${hms(bed)}`,
      `DTEND:${ymd(endDay)}T${hms(wake)}`,
      `SUMMARY:${escapeText(row.day_type === 'work' ? opts.labels.workSummary : opts.labels.freeSummary)}`,
      `DESCRIPTION:${escapeText(opts.labels.description)}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
