/**
 * Cron Expression Parser — pure functions, no DOM.
 *
 * `cronstrue` produces the human-readable sentence and `croner` computes the
 * next run times; everything around them (normalising, macros, field
 * breakdown, formatting, error messages) lives here and is unit-tested.
 */
import { Cron } from 'croner';
import cronstrue from 'cronstrue';

export class CronError extends Error {
  override name = 'CronError';
}

export interface FieldSpec {
  id: string;
  /** Column heading, e.g. "Day of week". */
  name: string;
  /** Singular unit used in generated descriptions. */
  unit: string;
  /** Allowed values, shown in the breakdown table. */
  allowed: string;
}

export interface FieldBreakdown extends FieldSpec {
  value: string;
  meaning: string;
}

export interface Preset {
  id: string;
  label: string;
  expression: string;
}

export interface RunOptions {
  /** Instant to search from. Defaults to now. */
  from?: Date;
  /** IANA zone the expression is interpreted in. `local` uses the system zone. */
  timeZone?: string;
}

export const SAMPLE_EXPRESSION = '0 9 * * 1-5';

export const PRESETS: readonly Preset[] = [
  { id: 'every-minute', label: 'Every minute', expression: '* * * * *' },
  { id: 'every-15', label: 'Every 15 minutes', expression: '*/15 * * * *' },
  { id: 'hourly', label: 'Hourly', expression: '0 * * * *' },
  { id: 'midnight', label: 'Daily at midnight', expression: '0 0 * * *' },
  { id: 'weekdays-9am', label: 'Weekdays 9am', expression: '0 9 * * 1-5' },
  { id: 'first-of-month', label: 'First of month', expression: '0 0 1 * *' },
];

/** Non-standard but widely supported shorthands, expanded before parsing. */
export const MACROS: Readonly<Record<string, string>> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
};

const SECOND: FieldSpec = { id: 'second', name: 'Seconds', unit: 'second', allowed: '0–59' };
const MINUTE: FieldSpec = { id: 'minute', name: 'Minutes', unit: 'minute', allowed: '0–59' };
const HOUR: FieldSpec = { id: 'hour', name: 'Hours', unit: 'hour', allowed: '0–23' };
const DOM: FieldSpec = {
  id: 'day-of-month',
  name: 'Day of month',
  unit: 'day of the month',
  allowed: '1–31',
};
const MONTH: FieldSpec = { id: 'month', name: 'Month', unit: 'month', allowed: '1–12 or JAN–DEC' };
const DOW: FieldSpec = {
  id: 'day-of-week',
  name: 'Day of week',
  unit: 'day of the week',
  allowed: '0–7 or SUN–SAT (0 and 7 are Sunday)',
};

const FIVE_FIELDS = [MINUTE, HOUR, DOM, MONTH, DOW];
const SIX_FIELDS = [SECOND, ...FIVE_FIELDS];

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;
const WEEKDAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_NAMES = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];

/**
 * A curated set of zones, ordered west to east. Filtered against the runtime's
 * own list so we never offer a zone the browser cannot format.
 */
export const COMMON_TIME_ZONES: readonly string[] = [
  'UTC',
  'Pacific/Honolulu',
  'America/Anchorage',
  'America/Los_Angeles',
  'America/Denver',
  'America/Phoenix',
  'America/Chicago',
  'America/Mexico_City',
  'America/New_York',
  'America/Toronto',
  'America/Bogota',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'Atlantic/Reykjavik',
  'Europe/London',
  'Europe/Dublin',
  'Europe/Lisbon',
  'Europe/Madrid',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Europe/Stockholm',
  'Europe/Warsaw',
  'Europe/Athens',
  'Europe/Kyiv',
  'Europe/Moscow',
  'Africa/Lagos',
  'Africa/Johannesburg',
  'Africa/Cairo',
  'Africa/Nairobi',
  'Asia/Jerusalem',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Dhaka',
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

/** Trim, collapse runs of whitespace and drop a trailing comment. */
export function normalizeExpression(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

/** Expand `@daily` and friends into their 5-field equivalent. */
export function expandMacro(expression: string): string {
  const macro = MACROS[expression.toLowerCase()];
  return macro ?? expression;
}

/** Split into fields after normalising, validating the field count. */
export function splitExpression(input: string): { fields: string[]; specs: FieldSpec[] } {
  const expression = expandMacro(normalizeExpression(input));
  if (expression === '') {
    throw new CronError(
      'Enter a cron expression — for example “*/15 * * * *” (every 15 minutes) or “0 9 * * 1-5”.',
    );
  }
  if (expression.startsWith('@')) {
    throw new CronError(
      `“${expression}” is not a supported shorthand. Use one of ${Object.keys(MACROS).join(', ')}, ` +
        'or write the expression out in full.',
    );
  }
  const fields = expression.split(' ');
  if (fields.length < 5) {
    throw new CronError(
      `A cron expression needs 5 fields (minute hour day-of-month month day-of-week), ` +
        `or 6 with leading seconds — this one has ${fields.length}.`,
    );
  }
  if (fields.length > 6) {
    throw new CronError(
      `A cron expression takes at most 6 fields (seconds minute hour day-of-month month ` +
        `day-of-week) — this one has ${fields.length}.`,
    );
  }
  return { fields, specs: fields.length === 6 ? SIX_FIELDS : FIVE_FIELDS };
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function plural(unit: string): string {
  return unit.startsWith('day of the ') ? unit.replace('day of the', 'days of the') : `${unit}s`;
}

/** Human label for a single value inside a field (weekday and month names included). */
export function fieldValueLabel(value: string, spec: FieldSpec): string {
  const upper = value.toUpperCase();
  if (spec.id === 'day-of-week') {
    const named = WEEKDAY_NAMES.indexOf(upper);
    if (named !== -1) return WEEKDAYS[named] ?? value;
    const numeric = Number(value);
    if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 7) {
      return WEEKDAYS[numeric === 7 ? 0 : numeric] ?? value;
    }
  }
  if (spec.id === 'month') {
    const named = MONTH_NAMES.indexOf(upper);
    if (named !== -1) return MONTHS[named] ?? value;
    const numeric = Number(value);
    if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) {
      return MONTHS[numeric - 1] ?? value;
    }
  }
  return value;
}

/** Plain-English meaning of one field's value, e.g. "Every 15 minutes". */
export function describeField(value: string, spec: FieldSpec): string {
  const parts = value.split(',').filter((part) => part !== '');
  if (parts.length === 0) return `Every ${spec.unit}`;
  const described = parts.map((part) => {
    const [range = '', step] = part.split('/');
    const stepped = step !== undefined && step !== '';
    if (range === '*' || range === '?') {
      return stepped ? `every ${step} ${plural(spec.unit)}` : `every ${spec.unit}`;
    }
    if (range.includes('-')) {
      const [from = '', to = ''] = range.split('-');
      const span = `${fieldValueLabel(from, spec)} through ${fieldValueLabel(to, spec)}`;
      return stepped ? `every ${step} ${plural(spec.unit)} from ${span}` : `${span}`;
    }
    if (stepped)
      return `every ${step} ${plural(spec.unit)} starting at ${fieldValueLabel(range, spec)}`;
    return fieldValueLabel(range, spec);
  });
  const joined =
    described.length === 1
      ? (described[0] ?? '')
      : `${described.slice(0, -1).join(', ')} and ${described.at(-1)}`;
  return capitalise(joined);
}

/** One row per field, ready for the breakdown table. */
export function breakdown(input: string): FieldBreakdown[] {
  const { fields, specs } = splitExpression(input);
  return specs.map((spec, index) => {
    const value = fields[index] ?? '*';
    return { ...spec, value, meaning: describeField(value, spec) };
  });
}

function friendlyMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/^Error:\s*/i, '')
    .replace(/^CronPattern:\s*/i, '')
    .trim();
}

/** Human-readable description of the whole expression, via cronstrue. */
export function describeCron(input: string): string {
  const { fields } = splitExpression(input);
  try {
    return cronstrue.toString(fields.join(' '), {
      throwExceptionOnParseError: true,
      use24HourTimeFormat: true,
      verbose: false,
    });
  } catch (err) {
    throw new CronError(`${friendlyMessage(err)} Check the highlighted field and try again.`);
  }
}

/** The next `count` run times, as absolute instants. */
export function nextRuns(input: string, count = 10, options: RunOptions = {}): Date[] {
  const { fields } = splitExpression(input);
  const expression = fields.join(' ');
  const timeZone = options.timeZone && options.timeZone !== 'local' ? options.timeZone : undefined;
  let cron: Cron;
  try {
    cron = timeZone ? new Cron(expression, { timezone: timeZone }) : new Cron(expression);
  } catch (err) {
    throw new CronError(friendlyMessage(err));
  }
  const runs = cron.nextRuns(count, options.from ?? new Date());
  if (runs.length === 0) {
    throw new CronError(
      'This expression never runs — check that the day-of-month and month combination can ' +
        'actually happen (for example, 30 February never does).',
    );
  }
  return runs;
}

/** `2026-01-01 09:00:00` in the given zone (`local` for the system zone). */
export function formatInZone(date: Date, timeZone = 'local'): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timeZone === 'local' ? undefined : timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')} ${hour}:${get('minute')}:${get('second')}`;
}

/** Short weekday name in the given zone, e.g. "Mon". */
export function weekdayInZone(date: Date, timeZone = 'local'): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timeZone === 'local' ? undefined : timeZone,
    weekday: 'short',
  }).format(date);
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600_000],
  ['month', 30 * 24 * 3600_000],
  ['day', 24 * 3600_000],
  ['hour', 3600_000],
  ['minute', 60_000],
  ['second', 1000],
];

/** "in 15 minutes" / "2 hours ago", relative to `now`. */
export function formatRelative(date: Date, now: Date = new Date(), locale = 'en'): string {
  const diff = date.getTime() - now.getTime();
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= ms) return formatter.format(Math.round(diff / ms), unit);
  }
  return formatter.format(Math.round(diff / 1000), 'second');
}

/** Curated zones the current runtime can actually format. */
export function availableTimeZones(supported?: readonly string[]): string[] {
  const runtime =
    supported ??
    (typeof Intl.supportedValuesOf === 'function'
      ? (Intl.supportedValuesOf('timeZone') as string[])
      : undefined);
  if (!runtime) return [...COMMON_TIME_ZONES];
  const known = new Set(runtime);
  return COMMON_TIME_ZONES.filter((zone) => zone === 'UTC' || known.has(zone));
}

export interface CronReport {
  expression: string;
  description: string;
  fields: FieldBreakdown[];
  runs: Date[];
}

/** Everything the UI needs for one expression. Throws CronError when invalid. */
export function analyse(input: string, count = 10, options: RunOptions = {}): CronReport {
  const { fields } = splitExpression(input);
  return {
    expression: fields.join(' '),
    description: describeCron(input),
    fields: breakdown(input),
    runs: nextRuns(input, count, options),
  };
}
