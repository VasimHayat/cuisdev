/**
 * Unix Timestamp Converter — pure functions, no DOM.
 *
 * Every function that needs the current time takes it as an argument so the
 * tests are deterministic; the UI passes `new Date()`.
 */

export class TimestampError extends Error {
  override name = 'TimestampError';
}

export type TimestampUnit = 'seconds' | 'milliseconds' | 'microseconds' | 'nanoseconds';
export type UnitChoice = TimestampUnit | 'auto';

export interface ParsedTimestamp {
  /** Milliseconds since the Unix epoch. */
  ms: number;
  /** The unit the input was read as. */
  unit: TimestampUnit;
  /** The numeric value as typed, after cleaning separators. */
  value: number;
  /** True when the unit was guessed from the magnitude. */
  detected: boolean;
}

export interface Row {
  id: string;
  label: string;
  value: string;
}

export interface DescribeOptions {
  now?: Date;
  /** IANA zone, or `local` for the system zone. */
  timeZone?: string;
  locale?: string;
}

/** The largest absolute time value a JavaScript Date can hold. */
export const MAX_TIME_MS = 8_640_000_000_000_000;

/** 2026-01-01T00:00:00Z — used for the sample and the pre-rendered rows. */
export const SAMPLE_TIMESTAMP = '1767225600';

export const UNIT_LABELS: Record<TimestampUnit, string> = {
  seconds: 'seconds',
  milliseconds: 'milliseconds',
  microseconds: 'microseconds',
  nanoseconds: 'nanoseconds',
};

const UNIT_DIVISOR: Record<TimestampUnit, number> = {
  seconds: 0.001,
  milliseconds: 1,
  microseconds: 1000,
  nanoseconds: 1_000_000,
};

/** A short, west-to-east list of zones offered in the time zone select. */
export const TIME_ZONES: readonly string[] = [
  'UTC',
  'Pacific/Honolulu',
  'America/Anchorage',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/Mexico_City',
  'America/New_York',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Lisbon',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Warsaw',
  'Europe/Athens',
  'Europe/Moscow',
  'Africa/Lagos',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Asia/Jerusalem',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Perth',
  'Australia/Sydney',
  'Pacific/Auckland',
];

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;
const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const NUMERIC = /^[+-]?\d+(\.\d+)?$/;

/** Strip the separators people paste: spaces, underscores, thousands commas. */
export function cleanNumericInput(input: string): string {
  return input.trim().replace(/[\s_]/g, '').replace(/,/g, '');
}

/**
 * Guess the unit from the magnitude. Ten-digit values are seconds, thirteen
 * are milliseconds, sixteen microseconds and nineteen nanoseconds — the
 * boundaries sit between them so 2001–5138 is unambiguous.
 */
export function detectUnit(value: number): TimestampUnit {
  const magnitude = Math.abs(value);
  if (magnitude < 1e11) return 'seconds';
  if (magnitude < 1e14) return 'milliseconds';
  if (magnitude < 1e17) return 'microseconds';
  return 'nanoseconds';
}

/** Parse a timestamp string into milliseconds, detecting the unit when asked to. */
export function parseTimestamp(input: string, unit: UnitChoice = 'auto'): ParsedTimestamp {
  const cleaned = cleanNumericInput(input);
  if (cleaned === '') {
    throw new TimestampError(
      'Enter a Unix timestamp — for example 1767225600 (seconds) or 1767225600000 (milliseconds).',
    );
  }
  if (!NUMERIC.test(cleaned)) {
    throw new TimestampError(
      `“${input.trim()}” is not a number. A Unix timestamp is a count of seconds since ` +
        '1 January 1970, like 1767225600. Use the date field below to convert a date instead.',
    );
  }
  const value = Number(cleaned);
  if (!Number.isFinite(value)) {
    throw new TimestampError('That number is too large to read as a timestamp.');
  }
  const resolved = unit === 'auto' ? detectUnit(value) : unit;
  const ms = value / UNIT_DIVISOR[resolved];
  if (!Number.isFinite(ms) || Math.abs(ms) > MAX_TIME_MS) {
    throw new TimestampError(
      `That is outside the range a date can represent (±8,640,000,000,000,000 ms, roughly ` +
        `±273,790 years around 1970). Check whether the value is really in ${UNIT_LABELS[resolved]}.`,
    );
  }
  return { ms, unit: resolved, value, detected: unit === 'auto' };
}

/** Offset of a zone from UTC, in milliseconds, at a given instant. */
export function timeZoneOffsetMs(timeZone: string, date: Date): number {
  if (timeZone === 'local') return -date.getTimezoneOffset() * 60_000;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second'),
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * A Date shifted so its UTC getters report the wall-clock values of `timeZone`.
 * Only ever read with getUTC* — never format it directly.
 */
function wallClock(ms: number, timeZone: string): Date {
  return new Date(ms + timeZoneOffsetMs(timeZone, new Date(ms)));
}

function pad(value: number, length = 2): string {
  return String(Math.abs(value)).padStart(length, '0');
}

/** `+05:30`, `-05:00`, `Z`. */
export function formatOffset(offsetMs: number): string {
  if (offsetMs === 0) return 'Z';
  const sign = offsetMs < 0 ? '-' : '+';
  const minutes = Math.round(Math.abs(offsetMs) / 60_000);
  return `${sign}${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** ISO 8601 in UTC, e.g. `2026-01-01T00:00:00.000Z`. */
export function toIsoUtc(ms: number): string {
  return new Date(ms).toISOString();
}

/** ISO 8601 with the zone's own offset, e.g. `2026-01-01T05:30:00+05:30`. */
export function toIsoWithOffset(ms: number, timeZone = 'local'): string {
  const offset = timeZoneOffsetMs(timeZone, new Date(ms));
  const local = wallClock(ms, timeZone);
  const year = local.getUTCFullYear();
  const yearText = year < 0 ? `-${pad(year, 6)}` : pad(year, 4);
  return (
    `${yearText}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}` +
    `T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}` +
    formatOffset(offset)
  );
}

/** RFC 2822 / HTTP date in UTC, e.g. `Thu, 01 Jan 2026 00:00:00 GMT`. */
export function toRfc2822(ms: number): string {
  const date = new Date(ms);
  const weekday = WEEKDAYS_SHORT[date.getUTCDay()] ?? 'Sun';
  const month = MONTHS_SHORT[date.getUTCMonth()] ?? 'Jan';
  return (
    `${weekday}, ${pad(date.getUTCDate())} ${month} ${pad(date.getUTCFullYear(), 4)} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} GMT`
  );
}

/** Day of the year, 1–366, in the given zone. */
export function dayOfYear(ms: number, timeZone = 'local'): number {
  const local = wallClock(ms, timeZone);
  const startOfYear = Date.UTC(local.getUTCFullYear(), 0, 1);
  return Math.floor((local.getTime() - startOfYear) / 86_400_000) + 1;
}

/** Number of days in the given (zoned) year. */
export function daysInYear(ms: number, timeZone = 'local'): number {
  const year = wallClock(ms, timeZone).getUTCFullYear();
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}

/** ISO 8601 week number and its week-numbering year. */
export function isoWeek(ms: number, timeZone = 'local'): { year: number; week: number } {
  const local = wallClock(ms, timeZone);
  const date = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
  // Thursday of the current ISO week decides the year.
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return { year: date.getUTCFullYear(), week };
}

/** Weekday name in the given zone. */
export function weekdayName(ms: number, timeZone = 'local'): string {
  return WEEKDAYS[wallClock(ms, timeZone).getUTCDay()] ?? 'Sunday';
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86_400_000],
  ['month', 30 * 86_400_000],
  ['week', 7 * 86_400_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
  ['second', 1000],
];

/** "in 3 hours" / "2 days ago", relative to `now`. */
export function relativeTime(ms: number, now: Date = new Date(), locale = 'en'): string {
  const diff = ms - now.getTime();
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= size) return formatter.format(Math.round(diff / size), unit);
  }
  return formatter.format(0, 'second');
}

/** Full local date and time, e.g. `Thursday, 1 January 2026 at 00:00:00`. */
export function formatLocal(ms: number, timeZone = 'local', locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timeZone === 'local' ? undefined : timeZone,
    dateStyle: 'full',
    timeStyle: 'medium',
    hour12: false,
  }).format(new Date(ms));
}

/** Unix seconds, floored so pre-1970 values stay correct. */
export function unixSeconds(ms: number): number {
  return Math.floor(ms / 1000);
}

/** Every derived value for one instant, in display order. */
export function describeTimestamp(ms: number, options: DescribeOptions = {}): Row[] {
  const timeZone = options.timeZone ?? 'local';
  const locale = options.locale ?? 'en-GB';
  const week = isoWeek(ms, timeZone);
  return [
    { id: 'iso', label: 'ISO 8601 (UTC)', value: toIsoUtc(ms) },
    { id: 'iso-offset', label: 'ISO 8601 (selected zone)', value: toIsoWithOffset(ms, timeZone) },
    { id: 'rfc', label: 'RFC 2822', value: toRfc2822(ms) },
    { id: 'local', label: 'Date and time', value: formatLocal(ms, timeZone, locale) },
    {
      id: 'relative',
      label: 'Relative',
      value: options.now ? relativeTime(ms, options.now) : '—',
    },
    { id: 'weekday', label: 'Day of week', value: weekdayName(ms, timeZone) },
    {
      id: 'day-of-year',
      label: 'Day of year',
      value: `${dayOfYear(ms, timeZone)} of ${daysInYear(ms, timeZone)}`,
    },
    {
      id: 'iso-week',
      label: 'ISO week',
      value: `${week.year}-W${pad(week.week)}`,
    },
    { id: 'seconds', label: 'Unix seconds', value: String(unixSeconds(ms)) },
    { id: 'milliseconds', label: 'Unix milliseconds', value: String(Math.round(ms)) },
  ];
}

/** Parse free text (ISO 8601, RFC 2822, anything `Date.parse` understands). */
export function parseDateText(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') {
    throw new TimestampError(
      'Enter a date — for example 2026-01-01T09:30:00Z or Thu, 01 Jan 2026 09:30:00 GMT.',
    );
  }
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) {
    throw new TimestampError(
      `“${trimmed}” could not be read as a date. Try ISO 8601 (2026-01-01T09:30:00Z), ` +
        'an RFC 2822 date, or use the date and time picker.',
    );
  }
  return ms;
}

/**
 * Convert a naive `datetime-local` value (`2026-01-01T09:30`, no offset) to
 * milliseconds, reading the wall clock in `timeZone`.
 */
export function zonedInputToMs(value: string, timeZone = 'local'): number {
  const trimmed = value.trim();
  if (trimmed === '') {
    throw new TimestampError('Pick a date and time first.');
  }
  const match =
    /^(-?\d{4,6})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?$/.exec(trimmed);
  if (!match) {
    throw new TimestampError(
      `“${trimmed}” is not a date and time. Expected something like 2026-01-01T09:30.`,
    );
  }
  const [, year, month, day, hour, minute, second = '0', millis = '0'] = match;
  const naive = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(millis.padEnd(3, '0')),
  );
  // Two passes: the offset itself depends on the instant (DST).
  const firstGuess = naive - timeZoneOffsetMs(timeZone, new Date(naive));
  return naive - timeZoneOffsetMs(timeZone, new Date(firstGuess));
}

/** `2026-01-01T09:30` in the given zone — the value a datetime-local input wants. */
export function msToZonedInput(ms: number, timeZone = 'local'): string {
  const local = wallClock(ms, timeZone);
  return (
    `${pad(local.getUTCFullYear(), 4)}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}` +
    `T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}`
  );
}

/** The two rows shown under the date input. */
export function describeDate(ms: number): Row[] {
  return [
    { id: 'to-seconds', label: 'Unix seconds', value: String(unixSeconds(ms)) },
    { id: 'to-milliseconds', label: 'Unix milliseconds', value: String(Math.round(ms)) },
  ];
}
